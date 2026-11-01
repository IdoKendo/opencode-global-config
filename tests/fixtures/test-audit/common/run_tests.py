import hashlib
import json
import os
from pathlib import Path
import unittest


suite = unittest.defaultTestLoader.discover('tests')
result = unittest.TextTestRunner(verbosity=2).run(suite)
record = {
    'kind': 'shipping-suite',
    'tests': result.testsRun,
    'failures': len(result.failures),
    'errors': len(result.errors),
    'skipped': len(result.skipped),
    'digest': hashlib.sha256(b''.join(
        p.as_posix().encode() + p.read_bytes()
        for p in sorted(Path('.').rglob('*.py'))
    )).hexdigest(),
}
print(json.dumps(record))
if os.environ.get('AGENT_TEST_RECEIPTS'):
    with open(os.environ['AGENT_TEST_RECEIPTS'], 'a') as receipts:
        receipts.write(json.dumps(record) + '\n')
raise SystemExit(not result.wasSuccessful())
