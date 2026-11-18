"""Daily task outbox for the existing Nexus scheduler, standard library only."""
from datetime import datetime, timezone, timedelta
import hashlib
import json
import sqlite3
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from contextlib import contextmanager

def local_zone(name):
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError:
        if name == 'Asia/Jakarta':
            return timezone(timedelta(hours=7), name)
        raise

class DailySchedules:
    def __init__(self, db):
        self.db = str(db)
        Path(self.db).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as c:
            c.execute('CREATE TABLE IF NOT EXISTS daily_jobs (key TEXT PRIMARY KEY, state TEXT NOT NULL, request TEXT NOT NULL, receipt TEXT)')

    @contextmanager
    def connect(self):
        c = sqlite3.connect(self.db, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute('PRAGMA journal_mode=WAL')
        try:
            yield c
            c.commit()
        except Exception:
            c.rollback()
            raise
        finally:
            c.close()

    def stage(self, schedules, now=None):
        now = now or datetime.now(timezone.utc)
        if now.tzinfo is None:
            raise ValueError('Timezone-aware datetime required')
        created = []
        for schedule in schedules:
            if not schedule.get('enabled'):
                continue
            if not schedule.get('topic', '').strip():
                raise ValueError('Daily research requires a user-configured topic')
            local = now.astimezone(local_zone(schedule.get('timezone', 'Asia/Jakarta')))
            h, m = map(int, schedule['at'].split(':'))
            if not 0 <= h < 24 or not 0 <= m < 60:
                raise ValueError('Invalid daily time')
            if (local.hour, local.minute) < (h, m):
                continue
            key = 'daily:' + hashlib.sha256(f"{schedule['id']}:{local.date()}".encode()).hexdigest()
            req = {"key": key, "agent_id": "ops-review", "team_id": "intelligence", "date": str(local.date()),
                   "topic": schedule['topic'], "sources": schedule.get('sources', []),
                   "instruction": 'Research the configured topic. Cite original URLs, publication and retrieval times. Deduplicate. Distinguish reporting from verified facts. Never fabricate results.'}
            with self.connect() as c:
                if c.execute('INSERT OR IGNORE INTO daily_jobs VALUES (?, ?, ?, NULL)', (key, 'pending', json.dumps(req))).rowcount:
                    created.append(key)
        return created

    def dispatch(self, enqueue_once):
        """enqueue_once must dedupe key in original office.db and return receipt.
        Crash or timeout leaves an uncertain entry; reconcile via original queue.
        """
        with self.connect() as c:
            keys = [r[0] for r in c.execute("SELECT key FROM daily_jobs WHERE state='pending'")]
        for key in keys:
            with self.connect() as c:
                c.execute('BEGIN IMMEDIATE')
                if not c.execute("UPDATE daily_jobs SET state='dispatching' WHERE key=? AND state='pending'", (key,)).rowcount:
                    continue
                req = json.loads(c.execute('SELECT request FROM daily_jobs WHERE key=?', (key,)).fetchone()[0])
            try:
                receipt = enqueue_once(req)
                if not receipt or not receipt.get('run_id'):
                    raise ValueError('Missing durable run_id')
                state = 'done'
            except Exception as exc:
                state, receipt = 'uncertain', {'error': type(exc).__name__}
            with self.connect() as c:
                c.execute('UPDATE daily_jobs SET state=?,receipt=? WHERE key=?', (state, json.dumps(receipt), key))

    def reconcile(self, lookup_once):
        with self.connect() as c:
            keys = [r[0] for r in c.execute("SELECT key FROM daily_jobs WHERE state IN ('dispatching','uncertain')")]
        for key in keys:
            receipt = lookup_once(key)
            if receipt and receipt.get('run_id'):
                with self.connect() as c:
                    c.execute("UPDATE daily_jobs SET state='done',receipt=? WHERE key=?", (json.dumps(receipt), key))
