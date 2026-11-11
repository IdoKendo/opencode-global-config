---
name: write-commit-message
description: >-
  Use when suggesting, writing, or revising a Git commit message, including requests such as
  "suggest a commit message".
---

# Write Commit Message

Write commit messages that explain why a change matters and support claims with evidence.

- Before drafting, answer: What becomes better, possible, or correct because of this change?
  Use that answer as the subject's main point. Add implementation details only to explain the result.
  An implementation technique is not the benefit. State its effect on capability, correctness, or
  performance before naming the technique. Do not use "enable" to disguise an implementation detail
  as a new capability.
  Read the subject alone: does it explain why the change matters, or only what was edited?
  If it only names the operation, rewrite it around the supported benefit.
- Use the supplied change or inspect the diff. Do not invent benefits or describe changes outside
  that scope.
- Use numbers for benefits only when measurements support them in the stated environment.
  Local measurements do not prove CI performance. Identify those measurements as local or omit them.
- Follow the repository's commit conventions when available. Use the user's requested format.
- A request for a commit message does not authorize staging, committing, or file changes.
