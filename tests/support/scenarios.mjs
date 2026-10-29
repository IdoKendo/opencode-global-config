export const scenarios = {
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
