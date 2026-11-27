#!/usr/bin/env python3
import os, pathlib, time
assert os.environ['CHECK_ENV'] == 'literal $HOME spaces and "quotes"'
assert os.environ['NEXT_EXIT_TIMEOUT_MS'] == '10000'
root = pathlib.Path.cwd()
assert (root / 'node_modules/.bin/next').exists()
if not (root / 'attempt').exists():
    (root / 'attempt').touch()
    blocks = []
    for _ in range(40):
        blocks.append(bytearray(16 * 1024 * 1024))
        time.sleep(0.02)
    raise SystemExit('FAIL: allocated 640M without hitting 512M cap')
assert not (root / '.next/dev/cache/corrupt').exists()
(root / '.next').mkdir(exist_ok=True)
(root / '.next/healthy').touch()
(root / 'healthy.pid').write_text(str(os.getpid()))
print('Healthy replacement; cwd, env and cold cache verified.', flush=True)
time.sleep(120)
