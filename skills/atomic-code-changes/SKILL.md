---
name: atomic-code-changes
description: Use when implementing code changes, bug fixes, refactors, or multi-step edits that may sprawl; keeps work split into atomic, independently verifiable changes.
---

# Atomic Code Changes

## Purpose

Keep each implementation step small enough to review, verify, and revert without dragging unrelated concerns along with it.

## Core Principle

One change should have one reason to exist.

If the work needs multiple reasons, split it into multiple changes before editing.

## Scope

- Applies to implementation work: fixes, features, refactors, migrations, tests, and docs tied to a code change.
- Use the smallest practical unit that still leaves the system coherent.
- Stop at task boundaries; do not roll adjacent cleanups, formatting sweeps, or opportunistic fixes into the same change.
- If a requested change is naturally broad, decompose it into ordered atomic steps first.

## Atomic Change Definition

An atomic change is:

- **Single-purpose:** solves one problem or advances one explicit step.
- **Coherent:** leaves the codebase in a working, understandable state.
- **Verifiable:** has a clear command, inspection, or manual check.
- **Reviewable:** the diff can be explained in one short sentence.
- **Reversible:** can be backed out without removing unrelated work.

## Workflow

1. **Name the outcome.** Write the next change as one sentence: "Make X do Y."
2. **Choose the verification.** Decide the smallest test, build, lint, or inspection that proves it.
3. **Edit only for that outcome.** Touch the minimum files needed; defer nearby improvements.
4. **Run the completion gate.** Verify before starting another concern.
5. **Reassess scope.** If the next edit has a different purpose, make it a separate step.

## Completion Gates

Before moving on, confirm:

- The change matches the named outcome.
- Verification passed or the remaining gap is explicitly reported.
- No unrelated formatting, cleanup, dependency, or behavior change slipped in.
- Follow-up work is noted instead of half-implemented.

## Scope Tripwires

Split the work when you notice:

- "While I'm here..." edits.
- A bug fix turning into a refactor.
- A refactor requiring behavior changes.
- Tests requiring new infrastructure.
- More than one subsystem, API, or user-visible behavior changing at once.

## Anti-Patterns

- Combining a feature, refactor, and formatting pass in one diff.
- Fixing unrelated warnings because they are nearby.
- Starting broad cleanup without a named verification path.
- Keeping edits after the original goal becomes ambiguous.

## Examples

- **Atomic:** Rename one helper and update its direct callers, then run the affected tests.
- **Not atomic:** Rename the helper, rewrite the module, update dependencies, and fix unrelated lint errors.
- **Atomic:** Add a failing regression test, then make the smallest behavior change that passes it.
- **Not atomic:** Add the regression test while also redesigning the surrounding API.

## Checklist

- [ ] One sentence describes the change.
- [ ] One verification method is identified.
- [ ] The diff serves only that sentence.
- [ ] Scope tripwires were split or documented.
- [ ] The final handoff names what changed and what was verified.
