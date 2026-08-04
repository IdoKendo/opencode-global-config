---
description: Reviews branch changes for unnecessary or inconsistent code
agent: build
---

Determine the repository's intended base branch from its upstream or default-branch configuration; do not assume it is `main`. Review changes from the merge base through the current working tree, including committed, staged, unstaged, and relevant untracked files. If the base branch cannot be determined reliably, ask the user before editing.

Remove only changes that are unnecessary, obscure behavior, or conflict with established project conventions. Do not infer whether code was AI-generated.

## Criteria

- Remove redundant comments or helpers when the code or standard library already expresses the same intent.
- Replace unsafe or unnecessary type conversions with type-correct code.
- Restore tests that were deleted, skipped, weakened, or bypassed solely to avoid failures.
- Match the naming, structure, and style of the surrounding code.
- Preserve intentional behavior and avoid unrelated cleanup.

## Verification

- Inspect the final diff to confirm every cleanup is within the branch scope and behavior is preserved.
- Run the smallest relevant existing tests, formatting checks, and linters for changed files.
- Report any verification that could not be completed and why.

Report only a 1-3 sentence summary of what changed and any verification gaps.
