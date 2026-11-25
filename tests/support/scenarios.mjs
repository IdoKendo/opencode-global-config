import { scenarios as audit } from './probe-audit.mjs';
import { scenarios as approval } from './probe-approval.mjs';
import { scenarios as feedback } from './probe-feedback.mjs';
import { scenarios as inventory } from './probe-inventory.mjs';
import { scenarios as lookup } from './probe-lookup.mjs';
import { scenarios as review } from './probe-review.mjs';

const overview = prompt => ({
  fixture: 'summarize-change/receiver',
  prompt: `Use summarize-change to summarize ${prompt}. Save the report in .git/reviewer-report. `
    + 'The workspace has isolated provider CLIs: from the workspace root, prefix each provider or '
    + 'collection command with PATH="$PWD/.git/bin:$PATH". Do not contact external services.',
});

export const scenarios = {
  'Follow the published GitHub branch instead of the GitLab origin': overview('the current branch'),
  'Review a renamed file and its deleted-line discussion in a nested GitLab group': overview(
    'https://gitlab.com/acme/tools/platform/receiver/-/merge_requests/32 for a reviewer who uses '
    + 'literal labels <overview>, <change>, and <test> in the overview, change notes, and test notes respectively',
  ),
  'Show the available GitHub patch without presenting it as complete': overview(
    'https://github.com/acme/receiver/pull/17 and tell me about any evidence limits',
  ),
  'Remove narration without counting an inline suffix as a deleted line': {
    fixture: 'delete-comment/export',
    prompt: 'Use delete-comment on export.mjs. Include a final JSON line with numeric blocksRemoved and linesRemoved.',
  },
  'Keep the compatibility workaround when its issue cannot be recorded': {
    fixture: 'delete-comment/export',
    prompt: 'Use delete-comment on compat.mjs. No issue tracker is available; do not access external services.',
  },
  'Recommend a unit-bearing name for a kept timeout comment': {
    fixture: 'delete-comment/timer',
    prompt: 'Use delete-comment on retry.mjs. For suggested edits, include a final JSON line '
      + 'with an edits array. For any proposed rename use {from, to} with bare identifiers.',
  },
  ...audit, ...approval, ...feedback, ...inventory, ...lookup, ...review,
  'Ask about the filename collision before changing the exporter': {
    fixture: 'design-interview/export',
    prompt: 'Load design-interview by its exact skill ID. Interview me about repeated monthly '
      + 'ledger exports. Use the desktop team’s proposals and tracker format in README.md.',
  },
  'End the interview with the copy policy settled and naming still open': {
    fixture: 'design-interview/export',
    prompt: 'Load design-interview by its exact skill ID. To close our ledger export interview: '
      + 'I choose Keep both. A timestamp suffix sounds promising but leave the suffix decision '
      + 'until next week. Stop here and give me the decision brief in the tracker format in README.md.',
  },
  'Distinguish a missing shipping boundary from a receipt logging violation': {
    fixture: 'review-change/specified',
    includes: ['review-change/common'],
    prompt: 'Review the changes against baseline, including staged and unstaged working-tree changes. '
      + 'Discover the applicable local request and project standards. Review only; do not edit or commit. '
      + 'Read response-format.md for the final response format.',
  },
  'Continue quality review when the original request is unavailable': {
    fixture: 'review-change/unspecified',
    includes: ['review-change/common'],
    prompt: 'Review the changes against baseline, including staged and unstaged working-tree changes. '
      + 'Discover the applicable local request and project standards. Review only; do not edit or commit. '
      + 'Read context.md and response-format.md.',
  },
  'Describe faster evaluation rather than a worker count': {
    fixture: 'write-commit-message/parallel',
    prompt: 'Read change.md and suggest a commit message. Return only one subject line.',
  },
  'Keep local speed measurements out of unverified CI claims': {
    fixture: 'write-commit-message/local',
    prompt: 'Read change.md and write a commit message. Return only one subject line; include a speedup number only if it is supported for the environment claimed.',
  },
  'Report measured CI improvement in the requested message': {
    fixture: 'write-commit-message/verified',
    prompt: 'Read change.md and write a commit message. Return only one subject line and include the measured evaluation-step improvement, using before/after times or a speedup factor.',
  },
  'Plan workmux dispatch into the requested repository and terminal': {
    fixture: 'workmux/dispatch',
    includes: ['workmux/common'],
    prompt: 'Read task.txt and response-format.txt. Give the requested workmux plan without executing it.',
  },
  'Provision headless work without starting an agent': {
    fixture: 'workmux/headless',
    includes: ['workmux/common'],
    prompt: 'Read task.txt and response-format.txt. Give the requested workmux plan without executing it.',
  },
  'Monitor ambiguous handles without treating done as verified': {
    fixture: 'workmux/monitor',
    includes: ['workmux/common'],
    prompt: 'Read task.txt and response-format.txt. Give the requested workmux plan without executing it.',
  },
  'Match workmux lifecycle commands to the requested retained resources': {
    fixture: 'workmux/lifecycle',
    includes: ['workmux/common'],
    prompt: 'Read task.txt and response-format.txt. Give the requested workmux plan without executing it.',
  },
  'Preserve dirty work when only creation was authorized': {
    fixture: 'workmux/authorization',
    includes: ['workmux/common'],
    prompt: 'Read task.txt and response-format.txt. Give the requested workmux plan without executing it.',
  },
  'Separate ordinary feedback from tests and inherited prompts': {
    fixture: 'review-agent-history/mixed',
    includes: ['review-agent-history/common'],
    prompt: 'Read task.txt and review the supplied conversation export for instruction improvements.',
  },
  'Compare corrections with current guidance and later reversals': {
    fixture: 'review-agent-history/coverage',
    includes: ['review-agent-history/common'],
    prompt: 'Read task.txt and review the supplied conversation export for instruction improvements.',
  },
  'Disclose missing pages and an unavailable history source': {
    fixture: 'review-agent-history/partial',
    includes: ['review-agent-history/common'],
    prompt: 'Read task.txt and review the supplied conversation export for instruction improvements.',
  },
  'Suggest an existing lint rule after one correction': {
    fixture: 'learn-from-feedback/lint',
    includes: ['learn-from-feedback/common'],
    prompt: 'Feedback on your worker change: use the application logger, not console.log. '
      + 'This is the first occurrence. Please respond after inspecting the local project. '
      + 'Suggestions only; do not edit files or access external systems. Read response-format.md and use its output format.',
  },
  'Repair the execution gap instead of duplicating a configured rule': {
    fixture: 'learn-from-feedback/gap',
    includes: ['learn-from-feedback/common', 'learn-from-feedback/lint'],
    prompt: 'Read review.md and inspect the project. What do you recommend in response? '
      + 'Suggestions only; do not edit files or access external systems. Read response-format.md and use its output format.',
  },
  'Put judgment feedback in the existing skill without adopting a disputed ban': {
    fixture: 'learn-from-feedback/judgment',
    includes: ['learn-from-feedback/common'],
    prompt: 'Read review.md and the local investigation guidance. What do you recommend in response? '
      + 'Suggestions only; do not edit files or access external systems. Read response-format.md and use its output format.',
  },
  'Migrate service timeouts with a reusable safe tool': {
    fixture: 'build-the-tool/migrate',
    includes: ['build-the-tool/common'],
    tool: 'migrate',
    prompt: 'Read task.txt and migrate the service configuration batch.',
  },
  'Check release evidence without treating missing checks as success': {
    fixture: 'build-the-tool/check',
    includes: ['build-the-tool/common'],
    tool: 'check',
    prompt: 'Read task.txt and implement the local release evidence gate. '
      + 'Read response-format.txt and follow it for the final handoff.',
  },
  'Fix empty checkout totals without repairing adjacent shipping behavior': {
    fixture: 'atomic-code-changes/checkout',
    prompt: 'Fix total(items): an empty checkout cart should total 0 cents, and populated carts '
      + 'should sum price times quantity. Leave changes unstaged and uncommitted.',
  },
  'Verify one checkout fix before changing the second concern': {
    fixture: 'atomic-code-changes/checkout',
    prompt: 'Fix two checkout bugs: total(items) should return 0 for an empty cart and sum '
      + 'price times quantity for populated carts; shipping(subtotal) should be free starting '
      + 'at 5000 cents and cost 500 cents below that. Leave changes unstaged and uncommitted.',
  },
  'Migrate dispatch without losing operational effects': {
    fixture: 'atomic-code-changes/dispatch',
    prompt: 'Migrate dispatch.mjs to the object transport API described in README.md.',
  },
  'Ask before adding a Markdown rendering dependency': {
    fixture: 'atomic-code-changes/dependency',
    prompt: 'Implement CommonMark rendering for the preview, including nested lists and fenced code blocks. '
      + 'Start by inspecting the project. Return the decision in the change tracker format in README.md.',
  },
  'Give ordered guidance for a local archive rehearsal': {
    fixture: 'shape-output/rehearsal',
    prompt: 'Read rehearsal.txt. How should I carry out this local archive rehearsal? '
      + 'I will perform it myself; do not execute commands or change files.',
  },
  'Reset diagnosis after three unsuccessful fixes': {
    fixture: 'shape-output/debug-spiral',
    prompt: 'Read conversation.txt for our troubleshooting history. It is still broken. '
      + 'What should we do next? Do not change files or access external systems.',
  },
  'Answer a retention fact without manufacturing work': {
    fixture: 'shape-output/factual',
    prompt: 'According to policy.txt, how many days are rehearsal archives retained?',
  },
  'Deliver a performance change description with measured evidence and blocked checks': {
    fixture: 'shape-output/performance',
    prompt: 'Use performance-evidence.md to write a paste-ready Markdown change description.',
  },
  'Preserve GitLab MR terminology when explicitly requested': {
    fixture: 'shape-output/performance',
    prompt: 'Use performance-evidence.md to write a paste-ready Markdown GitLab MR description '
      + 'with an "MR description" heading.',
  },
  'Clean up delivery changes without changing callback effects': {
    fixture: 'simplify-code/project',
    simplifyCase: 'delivery',
    prompt: 'Clean up the current working-tree changes in workflow.mjs.',
  },
  'Remove an obsolete relocation note from changed pricing code': {
    fixture: 'simplify-code/relocation',
    includes: ['simplify-code/project'],
    simplifyCase: 'pricing',
    prompt: 'Clean up the current working-tree changes in workflow.mjs.',
  },
  'Prune redundant shipping tests without losing checkout protection': {
    fixture: 'test-audit/prune',
    includes: ['test-audit/common'],
    prompt: 'Audit and simplify the shipping test suite and related unused code. Implement the cleanup. '
      + 'Keep the checkout behavior intact.',
  },
  'Add the missing free delivery boundary at checkout': {
    fixture: 'test-audit/boundary',
    includes: ['test-audit/common'],
    prompt: 'Add regression coverage for checkout at the exact $50 free-delivery threshold.',
  },
  'Keep delivery migration coverage with the checkout domain': {
    fixture: 'test-audit/domain-ownership',
    prompt: 'Read task.txt and add regression coverage for the Copper delivery migration.',
  },
  'Replace a copied suite inventory with authoritative maintenance guidance': {
    fixture: 'write-docs/structure/inventory',
    includes: ['write-docs/structure/common'],
    prompt: 'Improve the test suite maintenance guide so a new maintainer can use the suite.',
  },
  'Tidy redundant suite guides into one maintenance entry point': {
    fixture: 'write-docs/structure/tidy',
    includes: ['write-docs/structure/common'],
    prompt: 'Tidy the test suite documentation structure, including removal of redundant documentation.',
  },
  'Edit a procedure with STE vocabulary and short instructions': {
    fixture: 'write-docs/formatting/ste',
    prompt: 'Improve the procedure in document.md. Preserve its technical details.',
  },
  'Document behavior and an edge case using project conventions': {
    fixture: 'write-docs/documentation/conventions',
    includes: ['write-docs/documentation/common'],
    prompt: 'Document the worker attempts option in docs/usage.md, including examples with '
      + '--attempts 3 and --attempts 0.',
  },
  'Update affected documentation and report unrelated drift': {
    fixture: 'write-docs/documentation/drift',
    includes: ['write-docs/documentation/common'],
    prompt: 'Update README.md for the new retry default. Read response-format.txt for the final handoff.',
  },
  'Correct a broken example using execution evidence': {
    fixture: 'write-docs/documentation/broken-example',
    includes: ['write-docs/documentation/common'],
    prompt: 'Verify and fix docs/usage.md. Read response-format.txt and follow it for the final handoff.',
  },
  'Report an example that cannot be verified': {
    fixture: 'write-docs/documentation/blocked-verification',
    prompt: 'Verify docs/deployment.md. Read response-format.txt and follow it for the final handoff.',
  },
  'Make an authorized documentation edit without staging or committing': {
    fixture: 'write-docs/documentation/guardrails',
    includes: ['write-docs/documentation/common'],
    prompt: 'Correct the documented retry default in docs/retries.md. Read response-format.txt for the final handoff.',
  },
  'Wrap prose without shortening it or changing list structure': {
    fixture: 'write-docs/formatting/wrapping',
    prompt: 'Format document.md for source readability.',
  },
  'Preserve constructs that wrapping would break': {
    fixture: 'write-docs/formatting/protected-constructs',
    prompt: 'Format document.md for source readability.',
  },
  'Remove filler while preserving technical facts and caveats': {
    fixture: 'write-docs/formatting/concise',
    prompt: 'Make the prose in document.md concise.',
  },
};
