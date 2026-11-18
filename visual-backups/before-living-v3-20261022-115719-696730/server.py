#!/usr/bin/env python3
"""Local-only HTTP UI / JSON API. Python standard library; no package install."""
import argparse
import hmac
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import json
import mimetypes
import os
from pathlib import Path
import secrets
import threading
from urllib.parse import urlparse, parse_qs, unquote
from core import Office, ROOT

class Server(ThreadingHTTPServer):
    daemon_threads=True
    def __init__(self,address,office,preview=False):
        self.office=office; self.preview=preview
        token_file=office.data/'token'
        if not token_file.exists():
            fd=os.open(token_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
            with os.fdopen(fd,'w') as f: f.write(secrets.token_urlsafe(32))
        self.token=token_file.read_text().strip()
        super().__init__(address,Handler)
        self.allowed_hosts={f'127.0.0.1:{self.server_port}',f'localhost:{self.server_port}'}
        if preview: self.allowed_hosts.add('terminal.local:4173')
        office.base_url=f'http://127.0.0.1:{self.server_port}'

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def send(self,code,data,ctype='application/json'):
        body=json.dumps(data,ensure_ascii=False).encode() if ctype=='application/json' else data
        self.send_response(code); self.send_header('Content-Type',ctype); self.send_header('Content-Length',str(len(body)))
        self.send_header('Cache-Control','no-store'); self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers(); self.wfile.write(body)
    def gate(self,auth=False):
        host=self.headers.get('Host','')
        if host not in self.server.allowed_hosts: self.send(403,{'error':'Host ditolak'}); return False
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+host: self.send(403,{'error':'Origin ditolak'}); return False
        if self.headers.get('Sec-Fetch-Site')=='cross-site': self.send(403,{'error':'Cross-site ditolak'}); return False
        if auth and not hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+self.server.token):
            self.send(401,{'error':'Token tidak valid'}); return False
        return True
    def do_GET(self):
        if not self.gate(): return
        u=urlparse(self.path); p=u.path
        if p=='/api/session': return self.send(200,{'token':self.server.token})
        if p.startswith('/api/'):
            if not self.gate(True): return
            o=self.server.office
            if p=='/api/state': return self.send(200,o.state())
            if p=='/api/brain': return self.send(200,o.brain(parse_qs(u.query).get('q',[''])[0]))
            if p.startswith('/api/tasks/'):
                rows=o.rows('SELECT * FROM tasks WHERE id=?',(p.rsplit('/',1)[-1],))
                return self.send(200,rows[0]) if rows else self.send(404,{'error':'Task tidak ada'})
            return self.send(404,{'error':'API tidak ada'})
        path=(ROOT/'web'/unquote(p).lstrip('/')).resolve() if p!='/' else ROOT/'web/index.html'
        if (ROOT/'web').resolve() not in path.parents or not path.is_file(): return self.send(404,{'error':'File tidak ada'})
        return self.send(200,path.read_bytes(),mimetypes.guess_type(path)[0] or 'application/octet-stream')
    def do_POST(self):
        if not self.gate(True): return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<1 or n>200000: return self.send(413,{'error':'Ukuran request tidak valid'})
            if 'application/json' not in self.headers.get('Content-Type',''): return self.send(415,{'error':'JSON diperlukan'})
            body=json.loads(self.rfile.read(n)); p=urlparse(self.path).path; o=self.server.office
            if not isinstance(body,dict): raise ValueError('Body harus object')
            if p=='/api/runs': return self.send(201,{'id':o.create_run(body.get('team'),body.get('title'),body.get('items'))})
            if p=='/api/cancel': o.cancel(body['id'])
            elif p=='/api/approve': o.approve(body['id'])
            elif p=='/api/memory/propose': return self.send(201,{'id':o.propose(body['title'],body['content'],body.get('source','user'))})
            elif p=='/api/memory/decide': o.decide_memory(body['id'],body['decision'])
            elif p=='/api/memory/sync': o.sync_memory()
            elif p=='/api/progress': o.progress(body['id'],body['progress'],body.get('message',''))
            else: return self.send(404,{'error':'API tidak ada'})
            return self.send(200,{'ok':True})
        except (ValueError,KeyError,TypeError) as e: self.send(400,{'error':str(e)})
        except Exception: self.send(500,{'error':'Kesalahan server; periksa konfigurasi dan runtime lokal'})

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int); parser.add_argument('--config'); parser.add_argument('--data-dir'); parser.add_argument('--preview',action='store_true')
    args,_=parser.parse_known_args(); o=Office(args.config,args.data_dir)
    if args.preview and o.c['mode']!='demo': raise SystemExit('Preview hanya boleh mode demo')
    server=Server(('0.0.0.0' if args.preview else '127.0.0.1',args.port or o.c['port']),o,args.preview)
    def sync_loop():
        while not o.stopping.wait(5):
            try: o.sync_memory()
            except Exception: o.event('memory.error','Gagal menyegarkan sumber memori')
    threading.Thread(target=sync_loop,daemon=True).start()
    print(f'Nexus Office: http://127.0.0.1:{server.server_port} · mode={o.c["mode"]}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close(); o.close()
if __name__=='__main__': main()
