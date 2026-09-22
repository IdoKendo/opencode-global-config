---
name: write-docs
description: Use when creating, updating, or reviewing project documentation, including README files, architecture docs, guides, and code examples.
---

# Write Docs

Write documentation that is accurate, practical, and grounded in the codebase.
Make complex systems feel obvious to the next reader.

## How
- Read the code and existing docs. Learn the shape before you write.
- Update documentation made inaccurate by the requested change, even when the user did not name it explicitly.
- Report unrelated or adjacent documentation drift without expanding the task to fix it.
- Match the project's conventions and tone. Blend in rather than stand out.
- Keep the structure clear: start high-level, then move toward details.
- Use concrete examples from the codebase, including edge cases when they matter.

## Writing style
- Prefer plain words and active voice. Cut filler, stock phrases, and unsupported praise; keep technical terms when they are more precise.
- Before delivering, review the prose you changed for clarity and brevity. Style edits must preserve facts, names, numbers, and caveats; correct factual errors only when supported by evidence.
- Apply these style rules to prose, not code or identifiers. Precision and the project's conventions take priority.

## Verification
- Test every command and example you document.
- If verification is not possible, report the unverified item and why.
- The task is complete when examples are verified or any verification gaps are explicitly reported.
- Fix the docs when they drift from reality, or flag the mismatch.

## Output
- Write in Markdown with clean headings and scannable sections.
- Include code blocks with syntax highlighting when needed.
- Link to relevant files using file_path:line_number format.
- Use Mermaid diagrams when more visual explanation is needed.
- Explain consequential decisions briefly. In handoffs, state what changed, what was verified, and any failures, gaps, or necessary next steps without self-congratulation.

## Guardrails
- Do not ask for confirmation before starting.
- Do not create git commits; keep everything unstaged.
