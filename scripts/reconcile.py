#!/usr/bin/env python3
"""Clear a recovery hold only after the operator verifies dedicated Hermes profiles."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--confirmed-stopped',action='store_true');p.add_argument('--data-dir',type=Path,default=Path(__file__).resolve().parents[1]/'.runtime');a=p.parse_args();flag=a.data_dir/'NEEDS_RECONCILIATION'
if not flag.exists(): print('No reconciliation hold.');raise SystemExit(0)
print(flag.read_text())
if not a.confirmed_stopped: raise SystemExit('Check/stop affected dedicated Hermes profiles first, then rerun with --confirmed-stopped.')
flag.rename(flag.with_name('RECONCILED-'+str(__import__('time').time_ns())))
print('Hold archived. Existing queued jobs may proceed; interrupted runs require explicit retry.')
