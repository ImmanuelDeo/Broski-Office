#!/usr/bin/env python3
"""Download the user's requested upstream. Never executes its setup automatically."""
import subprocess, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];dest=ROOT/'external/ai-creative-team'
if dest.exists(): raise SystemExit('Destination exists. Inspect it manually; nothing overwritten.')
dest.parent.mkdir(exist_ok=True)
subprocess.run(['git','clone','https://github.com/bekhruztbx/ai-creative-team.git',str(dest)],check=True)
commit=subprocess.check_output(['git','-C',str(dest),'rev-parse','HEAD'],text=True).strip()
(ROOT/'external/upstream-lock.json').write_text(json.dumps({'repository':'https://github.com/bekhruztbx/ai-creative-team','commit':commit},indent=2)+'\n')
print('Downloaded commit:',commit);print('Read README.md, LICENSE, CLAUDE.md, agent prompts, and tools/setup.sh before installing media dependencies.')
