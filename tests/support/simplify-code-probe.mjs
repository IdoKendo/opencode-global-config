// Independent runtime contracts and an AST-based nesting check for the tiny fixtures.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const [mode, filename] = process.argv.slice(2);

if (mode === 'structure') {
  const source = await readFile(filename, 'utf8');
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  assert.equal(tree.parseDiagnostics.length, 0, 'Cannot measure invalid JavaScript syntax');
  const branches = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.TryStatement,
    ts.SyntaxKind.WithStatement,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.ConditionalExpression,
  ]);

  function depth(node, level = 0) {
    const current = level + Number(branches.has(node.kind));
    let deepest = current;
    ts.forEachChild(node, (child) => {
      deepest = Math.max(deepest, depth(child, current));
    });
    return deepest;
  }

  console.log(depth(tree));
} else {
  const { process: runWorkflow } = await import(pathToFileURL(filename).href);
  assert.equal(typeof runWorkflow, 'function', 'workflow must export process');

  if (mode === 'pricing') {
    for (const [amount, member, expected] of [
      [0, false, 0], [0, true, 0], [99, false, 99], [99, true, 99],
      [100, false, 90], [100, true, 80], [101, false, 91], [101, true, 81],
      [100.5, true, 80.5],
    ]) {
      assert.equal(runWorkflow(amount, member), expected, `pricing result: ${amount}, ${member}, ${expected}`);
    }
    assert.equal(runWorkflow(100), 90, 'default member contract');
    for (const member of [false, true]) {
      assert.throws(() => runWorkflow(-1, member), (error) => {
        assert.ok(error instanceof RangeError, 'error type');
        assert.equal(error.message, 'amount must be non-negative', 'error message');
        return true;
      }, 'negative amount accepted');
    }
  } else if (mode === 'delivery') {
    const first = { enabled: true };
    const skipped = { enabled: false };
    const last = { enabled: true };
    const token = {};
    const events = [];
    const audit = (event, item) => { events.push([event, item]); };
    const send = (item) => {
      events.push(['send', item]);
      return token;
    };

    const iterator = [null, first, skipped, last].values();
    const items = { [Symbol.iterator]: () => iterator };
    const result = runWorkflow(items, send, audit);
    const expected = [
      ['missing', null], ['sending', first], ['send', first], ['sent', first],
      ['skipped', skipped], ['sending', last], ['send', last], ['sent', last],
    ];
    assert.equal(events.length, expected.length, 'callback count');
    for (const [index, [event, item]] of expected.entries()) {
      assert.equal(events[index][0], event, 'callback order or identity');
      assert.equal(events[index][1], item, 'callback order or identity');
    }
    assert.equal(result.length, 2, 'return identity');
    for (const item of result) assert.equal(item, token, 'return identity');

    events.length = 0;
    assert.deepEqual(runWorkflow([], send, audit), [], 'empty delivery');
    assert.deepEqual(events, [], 'empty delivery effects');

    const failure = new Error('offline');
    const fail = (item) => {
      events.push(['send', item]);
      throw failure;
    };
    assert.throws(() => runWorkflow([first, last], fail, audit), (error) => {
      assert.equal(error, failure, 'exception identity');
      return true;
    }, 'send error swallowed');
    assert.deepEqual(events, [['sending', first], ['send', first]], 'effects after send error');

    for (const failAt of ['sending', 'sent']) {
      events.length = 0;
      const failAudit = (event, item) => {
        events.push([event, item]);
        if (event === failAt) throw failure;
      };
      assert.throws(() => runWorkflow([first, last], send, failAudit), (error) => {
        assert.equal(error, failure, 'audit exception identity');
        return true;
      }, 'audit error swallowed');
      const beforeFailure = failAt === 'sending'
        ? [['sending', first]]
        : [['sending', first], ['send', first], ['sent', first]];
      assert.deepEqual(events, beforeFailure, 'effects after audit error');
    }
  } else {
    assert.fail(`Unknown contract: ${mode}`);
  }
  console.log('contract passed');
}
