"""Single-owner backend coordinator. Adapters call the existing core scheduler.
Start only after the original scheduler has acquired its process ownership lock.
"""
from datetime import datetime, timezone
from pathlib import Path
import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from .supervisor import Supervisor
from .schedules import DailySchedules, local_zone
from .facts import refresh_templates

class AddonRuntime:
    def __init__(self, project_root, adapter, config_dir=None):
        self.root = Path(project_root)
        self.adapter = adapter
        self.config_dir = Path(config_dir or self.root/'config/nexus-v3')
        self.db = self.root/'.runtime/nexus-v3-addon.db'
        self.supervisor = Supervisor(self.db)
        self.daily = DailySchedules(self.db)
        self.stop_event = threading.Event()
        self.thread = None
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='nexus-facts')
        self.fact_job = None
        self.fact_key = None
        self.lock = threading.Lock()
        with self.daily.connect() as c:
            c.execute('CREATE TABLE IF NOT EXISTS fact_refresh (day TEXT PRIMARY KEY, state TEXT NOT NULL)')

    def start(self):
        with self.lock:
            if self.thread and self.thread.is_alive():
                return
            if self.stop_event.is_set():
                raise RuntimeError('Create a new runtime instance after shutdown')
            self.supervisor.reconcile(self.adapter)
            self.daily.reconcile(self.adapter.lookup_daily)
            self.thread = threading.Thread(target=self._loop, name='nexus-v3-coordinator', daemon=True)
            self.thread.start()

    def _loop(self):
        while not self.stop_event.is_set():
            try:
                self.tick()
            except Exception as exc:
                # Report error class, not provider credentials or raw prompts.
                self.adapter.emit_event('addon.error', {'error': type(exc).__name__})
            self.stop_event.wait(5)

    def tick(self, now=None):
        now = now or datetime.now(timezone.utc)
        config = json.loads((self.config_dir/'schedules.json').read_text(encoding='utf-8'))
        for task in self.adapter.task_snapshots():
            decision = self.supervisor.observe(task, now.timestamp())
            if decision['action'] in ('inspect','escalate'):
                # Adapter must dedupe this durable queue entry by task+attempt+reason.
                self.adapter.supervisor_review_once(task, decision)
        for result in self.supervisor.dispatch(self.adapter, now.timestamp()):
            self.adapter.emit_event('supervisor.recovery', result)
        self.daily.stage(config.get('jobs', []), now)
        self.daily.dispatch(self.adapter.enqueue_daily_once)
        self._facts(config.get('facts_refresh', {}), now)

    def _facts(self, config, now):
        if self.fact_job and self.fact_job.done():
            try:
                facts, errors = self.fact_job.result()
                self.adapter.emit_event('facts.refreshed', {'count': len(facts)-len(errors), 'errors': len(errors)})
                status = 'done'
            except Exception as exc:
                self.adapter.emit_event('facts.failed', {'error': type(exc).__name__})
                status = 'failed'
            with self.daily.connect() as c:
                c.execute('UPDATE fact_refresh SET state=? WHERE day=?', (status, self.fact_key))
            self.fact_job = None
        if not config.get('enabled') or self.fact_job:
            return
        local = now.astimezone(local_zone(config.get('timezone','Asia/Jakarta')))
        h, m = map(int, config.get('at','07:30').split(':'))
        if not 0<=h<24 or not 0<=m<60:
            raise ValueError('Invalid facts refresh time')
        if (local.hour, local.minute)<(h,m):
            return
        key = str(local.date())
        with self.daily.connect() as c:
            # Claim before network request. A crash can skip today's refresh;
            # retaining yesterday's valid cache is safer than duplicate requests.
            if not c.execute('INSERT OR IGNORE INTO fact_refresh VALUES (?,?)', (key,'running')).rowcount:
                return
        templates = json.loads((self.config_dir/'fact-templates.json').read_text(encoding='utf-8'))
        budget = max(0,min(2,int(config.get('max_requests_per_day',2))))
        urls = list(dict.fromkeys(t['url'] for t in templates))[:budget]
        templates = [t for t in templates if t['url'] in urls]
        self.fact_key = key
        self.fact_job = self.pool.submit(refresh_templates, templates, self.root/'.runtime/nexus-v3-facts.json')

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=20)
            if self.thread.is_alive():
                raise RuntimeError('Coordinator still running; adapter calls must use bounded timeouts')
        self.pool.shutdown(wait=True, cancel_futures=True)
