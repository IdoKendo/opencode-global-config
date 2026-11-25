import assert from 'node:assert/strict';
import test from 'node:test';
import { checkHandoff, checkMarkup, checkPartial, checkProvider, checkRename } from '../support/change-overview.mjs';

const report = '/private/report/overview.html';
test('handoff names the delivered page and explains its takeaway or limitation', () => {
  checkHandoff(`The receiver was renamed. [Read the overview](${report})`, report, false);
  checkHandoff(`${report}: only one file patch was available.`, report, true);
  for (const [text, partial] of [
    ['The receiver was renamed.', false],
    [`See ${report}`, false],
    [`The receiver was not renamed. ${report}`, false],
    [`All patches are available. ${report}`, true],
  ]) assert.throws(() => checkHandoff(text, report, partial));
});

const mr = 'https://gitlab.example/group/team/project/-/merge_requests/32';
test('provider choice requires the right link and no fallback to the other CLI', () => {
  const page = `<a href="${mr}">Review</a>`;
  checkProvider(page, '["glab"]', mr, 'glab');
  assert.throws(() => checkProvider(page, '["gh"]\n["glab"]', mr, 'glab'));
  assert.throws(() => checkProvider(`<p>${mr}</p>`, '["glab"]', mr, 'glab'));
});

test('rename links the head file but the comment points to the removed line', () => {
  const links = `<a href="https://gitlab.example/group/team/project/-/blob/abc/after.txt">after.txt</a>
    <a href="${mr}#note_912">before.txt:2 (LEFT side)</a>`;
  checkRename(links, mr, 'abc');
  for (const [from, to] of [['abc', 'base'], ['before.txt:2', 'after.txt:2'], ['LEFT', 'RIGHT'], ['912', '123']]) {
    assert.throws(() => checkRename(links.replace(from, to), mr, 'abc'));
  }
});

test('markup must remain visible as text across the source and summary', () => {
  const page = '&lt;legacy&gt; +&lt;input&gt; Why remove &lt;retired&gt;? &lt;overview&gt; &lt;change&gt; &lt;test&gt;';
  checkMarkup(page);
  assert.throws(() => checkMarkup(page.replace('&lt;test&gt;', '')));
  assert.throws(() => checkMarkup(page + '<input>'));
});

test('partial page keeps both file evidence and the incomplete diff warning', () => {
  const page = '<aside>The diff is partial.</aside><pre>+available hunk</pre><a>other.txt</a>';
  checkPartial(page);
  for (const term of ['partial', '+available hunk', 'other.txt']) {
    assert.throws(() => checkPartial(page.replace(term, '')));
  }
});
