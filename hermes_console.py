"""Whitelisted bridge to the local Hermes CLI for the office console.

Every call is a fixed argv (never a shell string). The only free-form input is
the chat prompt, and it is passed as a single argv element.
"""
import json
import os
import shutil
import subprocess
import threading
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

HOME = Path.home()
CANDIDATES = [
    HOME / '.hermes/hermes-agent/.venv/bin/hermes',
    HOME / '.hermes/hermes-agent/.venv/Scripts/hermes.exe',
    HOME / '.local/bin/hermes',
]
TIMEOUT = 240
_cache = {'at': 0.0, 'data': None, 'stale': False}
_lock = threading.Lock()          # one refresh at a time
_chat_lock = threading.Lock()


def binary():
    for c in CANDIDATES:
        if c.is_file():
            return str(c)
    return shutil.which('hermes') or shutil.which('hermes.exe')


def available():
    return bool(binary())


def _run(args, timeout=30):
    exe = binary()
    if not exe:
        return {'ok': False, 'error': 'Hermes CLI tidak ditemukan di mesin ini'}
    env = {k: v for k, v in os.environ.items() if k not in ('HERMES_KANBAN_TASK',)}
    try:
        p = subprocess.run([exe, *args], cwd=str(HOME), env=env, timeout=timeout,
                           stdin=subprocess.DEVNULL, capture_output=True, text=True)
    except subprocess.TimeoutExpired:
        return {'ok': False, 'error': f'Perintah Hermes melewati batas {timeout}s'}
    except OSError as e:
        return {'ok': False, 'error': f'Gagal menjalankan Hermes: {e}'}
    out = (p.stdout or '') + (('\n' + p.stderr) if p.stderr else '')
    return {'ok': p.returncode == 0, 'code': p.returncode, 'text': out.strip()[-12000:]}


def _lines(text, limit=14):
    rows = [ln.rstrip() for ln in (text or '').splitlines()]
    return [ln for ln in rows if ln.strip()][:limit]


def overview(refresh=False):
    """Compact snapshot of the running Hermes install. Cached 20 s."""
    now = time.time()
    if not refresh and _cache['data'] and now - _cache['at'] < 20:
        return _cache['data']
    if not available():
        return {'available': False, 'error': 'Hermes CLI tidak ditemukan'}
    with _lock:
        if not refresh and _cache['data'] and time.time() - _cache['at'] < 20:
            return _cache['data']
        status = _run(['status'], 25)
        # The CLI has ~5-20 s cold-start per invocation; run the rest concurrently.
        with ThreadPoolExecutor(max_workers=4) as pool:
            sessions = pool.submit(_run, ['sessions', 'list', '--limit', '8'], 25).result()
            cron = pool.submit(_run, ['cron', 'list', '--all'], 25).result()
            kanban = pool.submit(_run, ['kanban', 'list', '--json'], 25).result()
            version = pool.submit(_run, ['--version'], 15).result()
        data = {
            'available': True,
            'version': (_lines(version.get('text'), 1) or [''])[0],
            'status_ok': status['ok'],
            'status': _lines(status.get('text'), 18),
            'sessions': _lines(sessions.get('text'), 12),
            'cron': _lines(cron.get('text'), 14),
            'kanban': [],
            'kanban_text': _lines(kanban.get('text'), 12),
            'fetched_at': int(now),
        }
        try:
            payload = json.loads(kanban.get('text') or '{}')
            tasks = payload.get('tasks') if isinstance(payload, dict) else payload
            if isinstance(tasks, list):
                data['kanban'] = [{
                    'id': t.get('id'), 'title': t.get('title'),
                    'status': t.get('status'), 'assignee': t.get('assignee'),
                } for t in tasks if isinstance(t, dict)][:20]
        except (ValueError, TypeError):
            pass
        _cache.update(at=now, data=data)
        return data


def chat(prompt, resume=None, model=None, provider=None):
    prompt = str(prompt or '').strip()
    if not prompt:
        raise ValueError('Prompt kosong')
    if len(prompt) > 4000:
        raise ValueError('Prompt maksimal 4000 karakter')
    args = ['-z', prompt]
    if resume:
        sid = str(resume).strip()
        if not sid.replace('-', '').isalnum():
            raise ValueError('ID sesi tidak valid')
        args += ['--resume', sid]
    for key, flag in ((model, '--model'), (provider, '--provider')):
        if key:
            val = str(key).strip()
            if len(val) > 80 or not all(c.isalnum() or c in '._/-' for c in val):
                raise ValueError('Nama model/provider tidak valid')
            args += [flag, val]
    if not _chat_lock.acquire(blocking=False):
        raise ValueError('Masih ada permintaan lain yang berjalan')
    try:
        return _run(args, TIMEOUT)
    finally:
        _chat_lock.release()


ACTIONS = {
    'pause': (['pause'], 30),
    'resume': (['resume'], 30),
    'skills': (['skills', 'list'], 30),
    'tools': (['tools', 'list'], 30),
    'doctor': (['doctor'], 90),
    'sessions': (['sessions', 'list', '--limit', '12'], 30),
    'cron_list': (['cron', 'list', '--all'], 30),
}


def act(action):
    entry = ACTIONS.get(str(action))
    if not entry:
        raise ValueError('Aksi tidak dikenal')
    args, timeout = entry
    return _run(args, timeout)
