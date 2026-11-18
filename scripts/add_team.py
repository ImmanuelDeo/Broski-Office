#!/usr/bin/env python3
"""Add a manifest team without changing source code. Restart the server afterward."""
import argparse, json, shutil, sys, time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import ROOT, validate_config
p=argparse.ArgumentParser();p.add_argument('--id',required=True);p.add_argument('--name',required=True);p.add_argument('--color',default='#8abbd8');p.add_argument('--description',default='Worker → reviewer → tinjauan pengguna');p.add_argument('--worker-prompt',default='prompts/researcher.md');a=p.parse_args()
path=ROOT/'config/office.json';c=json.loads(path.read_text());c['teams'].append({'id':a.id,'name':a.name,'color':a.color,'description':a.description,'icon':'layers','agents':[{'id':a.id+'-worker','name':a.name+' 01','role':'Specialist','stage':'worker','profile':'office-'+a.id+'-worker','model':'','prompt':a.worker_prompt,'avatar':{'shirt':a.color}},{'id':a.id+'-reviewer','name':a.name+' QA','role':'Quality Reviewer','stage':'reviewer','profile':'office-'+a.id+'-reviewer','model':'','prompt':'prompts/reviewer.md','avatar':{'shirt':a.color}}]})
validate_config(c)
backup=path.with_suffix('.backup-'+str(int(time.time()))+'.json');shutil.copy2(path,backup)
tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n');tmp.replace(path)
print('Team added. Backup:',backup.name);print('Restart office; provision two new Hermes profiles before live use.')
