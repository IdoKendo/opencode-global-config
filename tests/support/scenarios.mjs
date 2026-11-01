export const scenarios = {
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
  'Clean up pricing changes without changing boundary results': {
    fixture: 'simplify-code/project',
    simplifyCase: 'pricing',
    prompt: 'Clean up the current working-tree changes in workflow.py.',
  },
  'Clean up delivery changes without changing callback effects': {
    fixture: 'simplify-code/project',
    simplifyCase: 'delivery',
    prompt: 'Clean up the current working-tree changes in workflow.py.',
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
    prompt: 'Update README.md for the new retry default.',
  },
  'Correct a broken example using execution evidence': {
    fixture: 'write-docs/documentation/broken-example',
    includes: ['write-docs/documentation/common'],
    prompt: 'Verify and fix docs/usage.md.',
  },
  'Report an example that cannot be verified': {
    fixture: 'write-docs/documentation/blocked-verification',
    prompt: 'Verify docs/deployment.md.',
  },
  'Make an authorized documentation edit without staging or committing': {
    fixture: 'write-docs/documentation/guardrails',
    includes: ['write-docs/documentation/common'],
    prompt: 'Correct the documented retry default in docs/retries.md.',
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
