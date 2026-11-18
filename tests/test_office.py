import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.request
import urllib.error
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import Office, ROOT, validate_config
from server import Server

class OfficeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  c=json.loads((ROOT/'config/office.json').read_text());c['teams']=c['teams'][:1];c['mode']='demo';c['live_ready']=True;c['hermes_stop_args']=[];c['require_result_file']=False
  self.memory=self.root/'MEMORY.md';self.memory.write_text('Aturan brand: hijau. Bahasa Indonesia. 🧠',encoding='utf-8')
  c['memory_sources']=[{'id':'cached','path':str(self.memory)}];self.c=c;self.config=self.root/'config.json';self.save();self.o=Office(self.config,self.root/'data')
 def save(self):self.config.write_text(json.dumps(self.c))
 def tearDown(self):self.o.close();self.o.db.close();self.tmp.cleanup()
 def waitrun(self,rid,timeout=15):
  deadline=time.time()+timeout
  while time.time()<deadline:
   status=self.o.run_status(rid)
   if status in ('awaiting_approval','done','failed','cancelled','interrupted'):return status
   time.sleep(.1)
  self.fail('run timeout')
 def test_actual_utf8_bytes_and_source_readonly(self):
  before=self.memory.read_bytes();self.assertEqual(self.o.brain()['bytes'],len(before));self.o.sync_memory();self.assertEqual(before,self.memory.read_bytes())
 def test_proposals_only_after_approval(self):
  mid=self.o.propose('New rule','Make cover red');self.assertNotIn('Make cover red',self.o.snapshot()['text']);self.o.decide_memory(mid,'approved');self.assertIn('Make cover red',self.o.snapshot()['text'])
  with self.assertRaises(ValueError):self.o.decide_memory(mid,'rejected')
 def test_concurrent_proposals_no_lost_writes(self):
  with concurrent.futures.ThreadPoolExecutor(8) as p:ids=list(p.map(lambda i:self.o.propose(str(i),'content '+str(i)),range(40)))
  self.assertEqual(len(set(ids)),40);self.assertEqual(len(self.o.brain()['notes']),40)
 def test_bounded_snapshot_utf8(self):
  self.o.c['memory_context_bytes']=35;s=self.o.snapshot();self.assertLessEqual(s['included_bytes'],35);self.assertTrue(s['truncated']);s['text'].encode('utf-8')
 def test_missing_and_binary_sources(self):
  self.memory.unlink();self.o.sync_memory();self.assertEqual(self.o.brain()['sources'][0]['status'],'missing');self.memory.write_bytes(b'\xff\x00');self.o.sync_memory();self.assertEqual(self.o.brain()['sources'][0]['status'],'binary_unsupported')
 def test_configuration_guards(self):
  c=json.loads(json.dumps(self.c));c['teams'][0]['agents'][1]['profile']=c['teams'][0]['agents'][0]['profile']
  with self.assertRaises(ValueError):validate_config(c)
  with self.assertRaises(ValueError):self.o.create_run('missing','Brief',['a'])
  with self.assertRaises(ValueError):self.o.create_run('reports','Brief',[])
 def test_parallel_workers_then_reviewer_and_approval(self):
  rid=self.o.create_run('reports','Test pipeline',['A','B']);self.assertEqual(self.waitrun(rid),'awaiting_approval');tasks=self.o.rows('SELECT * FROM tasks WHERE run_id=?',(rid,));workers=[t for t in tasks if t['stage']=='worker'];review=[t for t in tasks if t['stage']=='reviewer'][0];self.assertEqual(len(workers),2);self.assertLessEqual(max(t['started'] for t in workers),min(t['finished'] for t in workers) + 0.1);self.assertGreaterEqual(review['started'],max(t['finished'] for t in workers));self.o.approve(rid);self.assertEqual(self.o.run_status(rid),'done')
 def test_cancel_and_invalid_approval(self):
  rid=self.o.create_run('reports','Cancel test',['A','B'])
  with self.assertRaises(ValueError):self.o.approve(rid)
  self.o.cancel(rid);time.sleep(.4);self.assertEqual(self.o.run_status(rid),'cancelled');self.assertTrue(all(t['status']=='cancelled' for t in self.o.rows('SELECT * FROM tasks WHERE run_id=?',(rid,))))
 def test_restart_recovery_no_replay(self):
  self.o.close();rid=self.o.create_run('reports','Pending restart',['A']);self.o.db.close();self.o=Office(self.config,self.root/'data');self.assertEqual(self.o.run_status(rid),'interrupted')
 def test_live_subprocess_contract(self):
  stub=self.root/'hermes_stub.py';stub.write_text('import sys,pathlib\np=pathlib.Path(sys.argv[sys.argv.index("--query-file")+1]); text=p.read_text(); assert "shared_memory" in text; print("PASS: stub executed; args preserved")\n')
  self.o.c['mode']='live';self.o.c['hermes_command']=[sys.executable,str(stub)]
  rid=self.o.create_run('reports','Do not execute $(echo BAD) `oops`',['input with spaces']);self.assertEqual(self.waitrun(rid),'awaiting_approval');self.assertTrue(all('stub executed' in t['output'] for t in self.o.rows('SELECT * FROM tasks WHERE run_id=?',(rid,))))
 def test_live_nonzero_exit_is_failure(self):
  self.o.c['mode']='live';self.o.c['hermes_command']=[sys.executable,'-c','import sys;sys.exit(3)'];rid=self.o.create_run('reports','Failure',['A']);self.assertEqual(self.waitrun(rid),'failed');self.assertEqual(len(self.o.rows('SELECT * FROM tasks WHERE run_id=?',(rid,))),1)
 def test_live_timeout_is_failure(self):
  self.o.c['mode']='live';self.o.c['task_timeout_seconds']=.4;self.o.c['hermes_command']=[sys.executable,'-c','import time;time.sleep(20)'];rid=self.o.create_run('reports','Timeout',['A']);self.assertEqual(self.waitrun(rid),'failed');self.assertIn('Timeout',self.o.rows('SELECT message FROM tasks WHERE run_id=?',(rid,))[0]['message'])
 def test_live_requires_explicit_setup(self):
  self.o.c['mode']='live';self.o.c['live_ready']=False
  with self.assertRaises(ValueError): self.o.create_run('reports','Brief',['A'])
 def test_live_receipt_missing_is_not_success(self):
  self.o.c['mode']='live';self.o.c['require_result_file']=True;self.o.c['hermes_command']=[sys.executable,'-c','print("not an actual receipt")'];rid=self.o.create_run('reports','No receipt',['A']);self.assertEqual(self.waitrun(rid),'failed')
 def test_live_valid_receipt(self):
  self.o.c['mode']='live';self.o.c['require_result_file']=True
  code='import os,json,pathlib;pathlib.Path(os.environ["NEXUS_RESULT_PATH"]).write_text(json.dumps({"status":"completed","summary":"verified stub","artifacts":[]}));print("stub")'
  self.o.c['hermes_command']=[sys.executable,'-c',code];rid=self.o.create_run('reports','Receipt',['A']);self.assertEqual(self.waitrun(rid),'awaiting_approval')
  self.assertTrue(all('verified stub' in t['output'] for t in self.o.rows('SELECT * FROM tasks WHERE run_id=?',(rid,))))
 def test_reconciliation_hold_blocks_new_work(self):
  (self.o.data/'NEEDS_RECONCILIATION').write_text('Uncertain external run')
  with self.assertRaises(ValueError): self.o.create_run('reports','Brief',['A'])
 def test_progress_requires_active_task(self):
  with self.assertRaises(ValueError):self.o.progress('absent',50,'x')
  with self.assertRaises(ValueError):self.o.progress('absent',110,'x')
 def test_http_auth_origin_static_and_mcp(self):
  server=Server(('127.0.0.1',0),self.o);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();base='http://127.0.0.1:'+str(server.server_port)
  try:
   with urllib.request.urlopen(base+'/') as r:self.assertIn(b'NEXUS',r.read())
   with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(base+'/api/state')
   self.assertEqual(e.exception.code,401)
   request=urllib.request.Request(base+'/api/session',headers={'Origin':'https://evil.example'})
   with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(request)
   self.assertEqual(e.exception.code,403)
   request=urllib.request.Request(base+'/api/state',headers={'Authorization':'Bearer '+server.token})
   with urllib.request.urlopen(request) as r:self.assertEqual(json.load(r)['mode'],'demo')
   with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(base+'/%2e%2e/core.py')
   env=os.environ.copy();env['NEXUS_DATA_DIR']=str(self.o.data);env['NEXUS_URL']=base
   messages=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05'}},{'jsonrpc':'2.0','method':'notifications/initialized'},{'jsonrpc':'2.0','id':2,'method':'tools/list'},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'office_brain','arguments':{}}}]
   p=subprocess.run([sys.executable,str(ROOT/'mcp_server.py')],input='\n'.join(json.dumps(x) for x in messages)+'\n',capture_output=True,text=True,env=env,timeout=10);out=[json.loads(l) for l in p.stdout.splitlines()];self.assertEqual(len(out),3);self.assertEqual(len(out[1]['result']['tools']),3);self.assertFalse(out[2]['result']['isError']);self.assertIn('Aturan brand',out[2]['result']['content'][0]['text'])
  finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
