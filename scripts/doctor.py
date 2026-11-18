#!/usr/bin/env python3
import json, shutil, subprocess, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import ROOT, validate_config
c=validate_config(json.loads((ROOT/'config/office.json').read_text()))
print('Python:',sys.version.split()[0]);print('Config: valid; mode =',c['mode']);print('Teams:',len(c['teams']))
exe=c['hermes_command'][0];found=shutil.which(exe)
print('Hermes:',found or 'NOT FOUND — demo remains available')
if found:
 for cmd in [[found,'--version'],[found,'chat','--help']]:
  r=subprocess.run(cmd,capture_output=True,text=True,timeout=20);print(r.stdout[:10000] or r.stderr[:2000])
for s in c['memory_sources']:
 p=Path(s['path']).expanduser();print('Memory:',s['id'],str(p),'FOUND' if p.is_file() else 'MISSING')
print('No credentials were read or changed. See docs/HERMES_SETUP.md for profile and MCP setup.')
