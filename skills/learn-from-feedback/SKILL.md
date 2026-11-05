---
name: learn-from-feedback
description: >-
  Use when receiving corrective feedback from the user, reading change-review feedback
  (including MR/PR threads), or learning from past feedback. Suggest the smallest durable
  safeguard: an existing lint rule, custom check, script, test, or skill improvement.
---

# Learn from Feedback

One useful correction is enough. Prefer executable safeguards over repeated instructions.
For judgment calls, improve the relevant skill and include an example of the failure.

## Workflow

1. Read the feedback in context, including review replies, revisions, and fixes when available.
   Identify the lesson and exceptions. Do not turn disputed advice or one-time requests into rules.
2. Inspect existing checks, configuration, execution paths, and skills before adding protection.
   Repair missing execution, exclusions, unclear instructions, or failed skill discovery first.
3. Choose the smallest useful safeguard:
   - Prefer a maintained, compatible lint rule over a custom check.
   - Use a custom lint, script, behavioral test, or architecture check for a precise uncovered rule.
   - Update an existing skill for judgment or workflow lessons; create one only for a distinct gap.
   - If protection already works or no durable lesson exists, explain why no addition is needed.
4. Suggest the change: source lesson, destination, prevented mistake, limits, and upkeep.
   Keep local rules local. A structural fix needs no duplicate prose rule.

Feedback authorizes suggestions, not safeguard edits or external actions. Implement only when
authorized. Do not expand ordinary feedback into a history audit.

## Verification

For approved changes, check the original failure and valid exceptions through the normal execution
path. For skill edits, check both discovery and behavior. Use `build-the-tool`, `test-audit`, and
`atomic-code-changes` as applicable. Distinguish suggestions, inspected facts, and executed results.
