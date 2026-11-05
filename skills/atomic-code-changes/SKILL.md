---
name: atomic-code-changes
description: >-
  Use when implementing code changes, bug fixes, refactors, or multi-step edits that may sprawl;
  keeps work split into atomic, independently verifiable changes.
---

# Atomic Code Changes

Keep each step single-purpose, independently verifiable, reviewable, and reversible.
Use the smallest step that leaves the system coherent, including related tests and docs.

## Workflow

Before a refactor or migration, inspect the existing implementation or named reference.
Identify affected capabilities, integrations, and operational effects, including logs and metrics.
Use this inventory to choose behavior-preservation checks.

1. Split broad work into ordered steps. State each outcome in one sentence.
   Choose its verification.
2. Edit only for that outcome. Defer adjacent fixes, refactors, and formatting.
   Add dependencies, abstractions, infrastructure, or persistent files only when required.
3. Run the step's checks before changing another concern. Start with focused checks, then expand for
   the affected scope and risk. Use supported repository commands and applicable
   verification skills.
   Complete requested CI or runtime checks when accessible; a smoke test does not replace them.
4. If the purpose changes, separate the next step. If the goal becomes unclear, stop and clarify it.

## Completion Gates

Before moving on, confirm that the diff serves only the stated outcome and verification passed.
Report any verification gap explicitly.
Inspect the diff for unnecessary complexity, duplication, and temporary artifacts.
Remove only artifacts you created. Keep requested evidence outside the repository unless requested.
Note follow-up work instead of partially implementing it.
