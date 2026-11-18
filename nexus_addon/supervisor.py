"""Persistent bounded recovery outbox; wire inside the existing scheduler owner.

The backend adapter MUST implement atomic task locking, idempotent resume and
lookup by recovery key. Never launch a parallel Hermes subprocess from this module.
"""
from __future__ import annotations
import hashlib
import json
import sqlite3
import time
from pathlib import Path
from typing import Protocol
from contextlib import contextmanager

RECOVERABLE = {"rto", "interrupted", "truncated", "rate_limit", "transient_tool"}
TERMINAL = {"completed", "cancelled", "blocked", "awaiting_approval"}

class RecoveryAdapter(Protocol):
    def resume_once(self, request: dict) -> dict:
        """Atomically check task/attempt, no live process, approval and cancellation.
        Use request['key'] as persistent idempotency key. Continue original task
        from checkpoint; return {'attempt_id': str}, or {'skipped': reason}.
        """
    def lookup_recovery(self, key: str) -> dict | None:
        """Return a durable receipt after ambiguous dispatch; None = unresolved."""

class Supervisor:
    def __init__(self, db: str | Path, max_retries=3, stale_seconds=180):
        self.db = str(db)
        self.max_retries = max_retries
        self.stale_seconds = stale_seconds
        Path(self.db).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript("""
              CREATE TABLE IF NOT EXISTS recovery (
                key TEXT PRIMARY KEY, task_id TEXT NOT NULL, attempt_id TEXT NOT NULL,
                seq INTEGER NOT NULL, state TEXT NOT NULL, due REAL NOT NULL,
                request TEXT NOT NULL, receipt TEXT, error TEXT,
                UNIQUE(task_id, attempt_id)
              );
              CREATE INDEX IF NOT EXISTS recovery_due ON recovery(state, due);
            """)

    @contextmanager
    def connect(self):
        c = sqlite3.connect(self.db, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA journal_mode=WAL")
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()

    def observe(self, task: dict, now: float | None = None) -> dict:
        now = time.time() if now is None else now
        required = {"id", "attempt_id", "status", "process_alive", "error_code",
                    "heartbeat_at", "checkpoint", "safe_to_retry", "cancelled"}
        if not required <= task.keys():
            raise ValueError(f"Missing supervisor fields: {required-task.keys()}")
        if not task['id'] or not task['attempt_id']:
            raise ValueError('Task and attempt IDs cannot be empty')
        if task["cancelled"] or task["status"] in TERMINAL:
            return {"action": "none", "reason": task["status"]}
        if task["process_alive"] is not False:
            stale = task["heartbeat_at"] is not None and now-task["heartbeat_at"] > self.stale_seconds
            return {"action": "inspect" if stale else "wait", "reason": "Process alive or ownership unknown; do not duplicate"}
        if task["status"] not in {"failed", "interrupted"}:
            return {"action": "wait", "reason": "Not a confirmed failed attempt"}
        if task["error_code"] not in RECOVERABLE or task["safe_to_retry"] is not True:
            return {"action": "escalate", "reason": "Non-transient or non-idempotent failure"}
        if not isinstance(task["checkpoint"], dict) or not task["checkpoint"].get("reference"):
            return {"action": "escalate", "reason": "Missing verified continuation checkpoint"}
        key = "recovery:" + hashlib.sha256(f"{task['id']}:{task['attempt_id']}".encode()).hexdigest()
        with self.connect() as c:
            c.execute("BEGIN IMMEDIATE")
            previous = c.execute("SELECT * FROM recovery WHERE key=?", (key,)).fetchone()
            if previous:
                return {"action": previous["state"], "key": key}
            unresolved = c.execute("SELECT key FROM recovery WHERE task_id=? AND state IN ('pending','dispatching','uncertain')", (task['id'],)).fetchone()
            if unresolved:
                return {"action": "wait", "key": unresolved['key'], "reason": "Previous recovery unresolved"}
            count = c.execute("SELECT COUNT(*) FROM recovery WHERE task_id=? AND state!='skipped'", (task["id"],)).fetchone()[0]
            if count >= self.max_retries:
                return {"action": "escalate", "reason": "Recovery budget exhausted"}
            retry_after = max(0, min(float(task.get("retry_after") or 0), 86400))
            due = now + max([15, 45, 120][min(count, 2)], retry_after)
            request = {"key": key, "task_id": task["id"], "expected_attempt_id": task["attempt_id"],
                       "checkpoint": task["checkpoint"], "error_code": task["error_code"],
                       "instruction": "Continue the original task from the verified checkpoint. Preserve completed artifacts and original acceptance criteria. Do not repeat committed side effects.",
                       "retry": count+1, "supervisor_agent_id": "planner"}
            c.execute("INSERT INTO recovery VALUES (?,?,?,?,?,?,?,?,?)",
                      (key, task['id'], task['attempt_id'], count+1, 'pending', due, json.dumps(request), None, None))
        return {"action": "pending", "key": key, "due": due}

    def dispatch(self, adapter: RecoveryAdapter, now: float | None = None) -> list[dict]:
        now = time.time() if now is None else now
        with self.connect() as c:
            rows = c.execute("SELECT key FROM recovery WHERE state='pending' AND due<=? ORDER BY due LIMIT 8", (now,)).fetchall()
        results = []
        for row in rows:
            with self.connect() as c:
                c.execute("BEGIN IMMEDIATE")
                if not c.execute("UPDATE recovery SET state='dispatching' WHERE key=? AND state='pending'", (row['key'],)).rowcount:
                    continue
                req = json.loads(c.execute("SELECT request FROM recovery WHERE key=?", (row['key'],)).fetchone()[0])
            try:
                receipt = adapter.resume_once(req)
                if not isinstance(receipt, dict) or not (receipt.get('attempt_id') or receipt.get('skipped')):
                    raise ValueError('Adapter must return a durable receipt')
                state = 'skipped' if receipt.get('skipped') else 'done'
                with self.connect() as c:
                    c.execute("UPDATE recovery SET state=?,receipt=? WHERE key=?", (state, json.dumps(receipt), req['key']))
                results.append({"key": req['key'], "state": state})
            except Exception as exc:
                # Could have failed after committing a new attempt. Never blind-retry.
                with self.connect() as c:
                    c.execute("UPDATE recovery SET state='uncertain',error=? WHERE key=?", (type(exc).__name__, req['key']))
                results.append({"key": req['key'], "state": "uncertain"})
        return results

    def reconcile(self, adapter: RecoveryAdapter) -> int:
        """Call at startup with scheduler ownership acquired. Does not resubmit."""
        with self.connect() as c:
            rows = c.execute("SELECT key FROM recovery WHERE state IN ('dispatching','uncertain')").fetchall()
        n = 0
        for row in rows:
            receipt = adapter.lookup_recovery(row['key'])
            if receipt and (receipt.get('attempt_id') or receipt.get('skipped')):
                with self.connect() as c:
                    c.execute("UPDATE recovery SET state=?,receipt=? WHERE key=?", ('skipped' if receipt.get('skipped') else 'done', json.dumps(receipt), row['key']))
                n += 1
        return n
