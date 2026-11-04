---
name: write-docs
description: >-
  Use when creating, updating, or reviewing project documentation, including README files,
  architecture docs, guides, and code examples.
---

# Write Docs

Write documentation that is accurate, practical, and grounded in the codebase.
Make complex systems feel obvious to the next reader.

## How
- Read the code and existing docs. Learn the shape before you write.
- Update documentation made inaccurate by the requested change, even when the user did not name it
  explicitly.
- Inspect linked guides and adjacent documentation for the component you change.
  Report unrelated drift in the final handoff, with the file path and incorrect claim or command.
  Keep this inspection within the affected component; do not expand the task to fix unrelated drift.
- Match the project's conventions and tone. Before drafting new documentation, copy the section
  outline from a comparable guide. Keep its section names, heading levels, capitalization, and order.
  Put topic-specific headings under those sections instead of replacing them.
  Omit a section only when the new document has no content that belongs there.
- Keep the structure clear: start high-level, then move toward details.
- Use concrete examples from the codebase, including edge cases when they matter.

## Documentation structure
- Keep maintainer entry-point READMEs concise. Link to authoritative features, code, configuration,
  and commands instead of copying inventories, counts, or implementation details that can drift.
- Use one maintainer entry point for a suite. Add a nested README only when it serves a distinct
  reader need that the entry point and source files do not cover.

## Writing style
- Always use ASD-STE100 Simplified Technical English (STE) for English prose you write or rewrite.
  Read [the STE reference](references/asd-ste100.md) before drafting or editing prose.
  Apply its vocabulary and writing rules. Use the official standard for dictionary checks.
- Keep project structure and heading conventions. Use STE when the existing prose style conflicts.
  For formatting-only tasks, preserve the text; do not rewrite it to apply STE.
- Prefer plain words and active voice. Cut filler, stock phrases, and unsupported praise; keep
  technical terms when they are more precise.
- Before delivering, review the prose you changed for clarity and brevity. Style edits must preserve
  facts, names, numbers, and caveats; correct factual errors only when supported by evidence.
- Apply these style rules to prose, not code, identifiers, literal UI labels, or quoted output.
  Preserve technical meaning. Use the STE rules for technical names instead of changing identifiers.

## Verification
- For new documentation, compare the finished headings directly with the comparable guide.
  Restore missing sections that have relevant content, including content under a different heading.
  Fix unintended changes to heading names, levels, capitalization, or order.
- Measure Markdown source line lengths with a command or script before delivering. Count indentation
  and list markers toward the 100-character limit; reflow overlong prose and check again. Preserve
  list nesting and exempt only constructs where wrapping would break formatting or meaning.
- Test every command and example you document.
- If verification is not possible, report the unverified item and why.
- The task is complete when examples are verified or any verification gaps are explicitly reported.
- Fix the docs when they drift from reality, or flag the mismatch.

## Output
- Write in Markdown with clean headings and scannable sections.
- Wrap Markdown source lines at 100 characters for readability. Reflow prose with line breaks;
  do not shorten or alter content just to fit. Allow longer lines for tables, diagrams, code blocks,
  URLs, or other constructs where wrapping would break formatting or meaning.
- Include code blocks with syntax highlighting when needed.
- When documenting implementation behavior, include relevant source references in the document
  using file_path:line_number format. Verify that each reference locates the behavior it supports.
- Use Mermaid diagrams when more visual explanation is needed.
- Explain consequential decisions briefly. In handoffs, state what changed, what was verified, and
  any failures, gaps, or necessary next steps without self-congratulation.
- For unverified examples, name the exact command and missing prerequisite, including credential or
  environment-variable names. Distinguish checking failure behavior from successful verification.

## Guardrails
- Do not ask for confirmation before starting.
- Do not create git commits; keep everything unstaged.
