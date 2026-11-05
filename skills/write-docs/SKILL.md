---
name: write-docs
description: >-
  Use when creating, updating, or reviewing project documentation, including README files,
  architecture docs, guides, and code examples.
---

# Write Docs

## How
- Read the code, existing docs, and linked or adjacent guides within the affected component.
- Update all docs affected by the requested change. Report unrelated errors without changing them.
  Name the file and incorrect claim or command.
- For new docs, copy a comparable guide's section names, heading levels, capitalization, and order.
  Put topic-specific headings below these sections. Omit a section only if no content belongs there.
- Start with an overview, then give details and codebase examples, including relevant edge cases.

## Documentation structure
- Keep one concise maintainer entry point per suite. Link to authoritative features, code,
  configuration, and commands; do not copy inventories, counts, or implementation details.
  Add a nested README only for a separate reader need not covered by the entry point or source
  files.

## Writing style
- Read [the STE reference](references/asd-ste100.md) before writing or rewriting English prose.
  Apply ASD-STE100 vocabulary and writing rules; use the official standard for dictionary checks.
  STE takes priority over conflicting prose styles, but retain project structure and heading rules.
- Use plain words and active voice. Remove filler and unsupported praise.
  Keep precise technical terms.
- Preserve facts, names, numbers, and caveats. Correct factual errors only with evidence.
  Do not apply prose rules to code, identifiers, literal UI labels, or quoted output.
- For formatting-only tasks, preserve the text, list order, and nesting.

## Verification
- Review changed prose for clarity and brevity. Compare new headings with the guide used as a model.
  Restore relevant sections. Correct unintended changes to heading names, levels, case, and order.
- Measure Markdown source line lengths with a command or script. Count indentation and list markers.
  Reflow lines over 100 characters and check again; preserve content and list nesting.
  Exempt only constructs that wrapping would break, such as tables, diagrams, code blocks, and URLs.
- Test every documented command and example. Correct or report differences from actual behavior.
- Report each unverified command and its exact missing prerequisite.
  Include credential or variable names. Distinguish verified failure behavior from successful
  execution.

## Output
- Use Markdown headings, syntax-highlighted code blocks, and Mermaid diagrams where useful.
- Cite implementation behavior with `file_path:line_number` references in the document.
  Check that each reference locates the behavior it supports.
- Briefly explain consequential decisions.
  Report changes, verification, failures, gaps, and next steps.

## Guardrails
- Do not ask for confirmation before starting.
- Do not create git commits; keep everything unstaged.
