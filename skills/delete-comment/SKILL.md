---
name: delete-comment
description: Review and remove redundant source comments. Preserve contracts and directives, record decisions or open work before deletion, and measure physical lines removed.
---

# Delete comment

Work from the repository root. Explicit paths limit the review. Otherwise review changed
hand-written source (including staged and unstaged work); on a clean tree with no requested
base, review tracked source. For a branch review, select changes since the merge base with
the requested target. Record the comparison commit and starting working-tree state so the
cleanup can be distinguished from earlier edits.

Read applicable repository and component instructions. Inspect candidates in the syntax of
their file: strings, shell here-documents and YAML block scalars can contain comment-like
data. Exclude generated and vendored files, literal fixtures and protected paths. Preserve
licenses, shebangs, directives, suppressions, tool-consumed comments, required API docs
and useful explanations the code cannot supply.

Check the implementation, callers, tests, configuration and decision records as relevant:

- **Tautology:** Delete narration that only repeats the code.
- **Stale:** Confirm what invalidated the claim before deleting it.
- **Excuse:** Preserve the workaround's impact and completion condition in an existing
  or authorized new issue. Record its identifier before removing the comment.
- **Decision record:** Preserve the constraint and rationale in the repository's decision
  records. Cite the full path before removing the duplicate.

When keeping a comment that a code change could make unnecessary, name the exact symbol
and recommend the smallest change that would express the same information. Leave that
change as a follow-up; do not apply it during comment cleanup.

If evidence, a suitable record, access or authorization is missing, keep the comment and
report what is needed. Preserve existing edits, code and significant whitespace; do not
reformat, move code or remove blank lines for credit.

Review the incremental diff. Count contiguous comment blocks separately from physical source
lines removed: a five-line standalone block counts as five lines; an inline suffix counts
as one block but zero lines. Exclude earlier edits, blank-line cleanup and issue or decision
text. Run the repository's applicable comment ratchet against the comparison commit if one
exists; otherwise inspect the diff and run the relevant focused checks. Report the base hash,
findings by class, issue identifiers and decision paths, blocks and physical lines removed,
checks actually run and any blockers.
