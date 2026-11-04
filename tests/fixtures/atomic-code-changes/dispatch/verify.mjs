import assert from 'node:assert/strict';
import { appendFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dispatch } from './dispatch.mjs';

const mode = process.argv.includes('--legacy') ? 'legacy' : 'object';
const digest = createHash('sha256').update(readFileSync(new URL('./dispatch.mjs', import.meta.url)))
  .digest('hex');
let code = 0;
try {
  const first = { id: 'a' };
  const last = { id: 'b' };
  const firstResult = { receipt: 'A' };
  const lastResult = { receipt: 'B' };
  const events = [];
  const telemetry = {
    log: (...args) => events.push(['log', ...args]),
    increment: (name) => events.push(['metric', name]),
  };
  const transport = {
    send(item) {
      assert.equal(this, transport, 'transport receiver');
      events.push(['send', item]);
      if (item === first) return firstResult;
      assert.equal(item, last, 'input identity');
      return lastResult;
    },
  };
  const argument = () => mode === 'legacy' ? transport.send.bind(transport) : transport;
  const results = dispatch([first, last], argument(), telemetry);
  assert.equal(results.length, 2, 'result count');
  assert.equal(results[0], firstResult, 'first result identity');
  assert.equal(results[1], lastResult, 'last result identity');
  assert.deepEqual(events, [
    ['log', 'sending', 'a'], ['metric', 'delivery.attempts'], ['send', first],
    ['log', 'sent', 'a'], ['metric', 'delivery.sent'],
    ['log', 'sending', 'b'], ['metric', 'delivery.attempts'], ['send', last],
    ['log', 'sent', 'b'], ['metric', 'delivery.sent'],
  ], 'ordered operational effects');
  events.length = 0;
  assert.deepEqual(dispatch([], argument(), telemetry), [], 'empty batch output');
  assert.deepEqual(events, [], 'empty batch effects');
  const failure = new Error('transport offline');
  transport.send = function (item) {
    assert.equal(this, transport, 'failure receiver');
    events.push(['send', item]);
    throw failure;
  };
  assert.throws(() => dispatch([first, last], argument(), telemetry),
    (error) => error === failure, 'transport error identity');
  assert.deepEqual(events, [
    ['log', 'sending', 'a'], ['metric', 'delivery.attempts'], ['send', first],
  ], 'effects after transport failure');
  console.log('dispatch: PASS');
} catch (error) {
  code = 1;
  console.error(`dispatch: FAIL: ${error.message}`);
}
if (process.env.AGENT_TEST_RECEIPTS) {
  appendFileSync(process.env.AGENT_TEST_RECEIPTS,
    JSON.stringify({ kind: 'dispatch-contract', mode, code, digest }) + '\n');
}
process.exitCode = code;
