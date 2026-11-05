---
name: simplify-code
description: Proactively simplify recently modified code while preserving exact behavior.
---

# Simplify Code

## Principles

- Preserve behavior exactly, including outputs, side effects, public APIs, and documented contracts.
- Change only recently modified code unless the user requests broader refactoring.
- Prefer clear code to short code. Follow project conventions and retain useful abstractions.

## Guardrails

- Do not change performance characteristics unless requested.
- Avoid dense one-liners, nested ternaries, and optimizations that reduce readability.
- Remove obsolete relocation comments when moving or deleting code.
- Add comments only to explain unclear code.
  Use an ASCII diagram if it helps explain a confusing structure.

## Process

1. Inspect recently modified sections for unnecessary complexity and duplication.
2. Simplify control flow, reduce nesting, and remove redundant logic.
   Use clear names and minimal edits.
3. Verify that behavior is unchanged.
4. Document only changes that affect understanding.
