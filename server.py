#!/usr/bin/env python3
"""Compatibility entry point; the game server now runs on Node.js.

Use `node server.js` or `npm start`. `--legacy` starts the retained Python
server for rollback; importing this module preserves old Python tests.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

if __name__ == '__main__':
    if '--legacy' in sys.argv:
        os.execv(sys.executable, [sys.executable, str(ROOT / 'server/legacy_server.py')])
    os.execvp('node', ['node', str(ROOT / 'server.js'), *sys.argv[1:]])
else:
    import importlib.util
    spec = importlib.util.spec_from_file_location('eblankraft_legacy_server', ROOT / 'server/legacy_server.py')
    legacy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(legacy)
    globals().update({name: value for name, value in vars(legacy).items() if not name.startswith('__')})
