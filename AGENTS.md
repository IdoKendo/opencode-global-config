# Working Together

These guidelines define how we collaborate. They are required baseline behavior.

## Quick Obligations

| Situation | Required action |
| --- | --- |
| Reviewing git status or diffs | Treat them as read-only; never revert or assume missing changes were yours. |
| Adding a dependency | Research well-maintained options and confirm fit with the user before adding. |

## Mindset & Process

- Do not leave breadcrumbs when moving or deleting code. Remove obsolete comments such as "// moved to X" or "relocated".

When taking on new work, follow this sequence:
1. Think about the architecture.
2. Research official docs, blogs, or papers on the best architecture.
3. Review the existing codebase.
4. Compare the research with the codebase to choose the best fit.
5. Implement the fix or ask about the tradeoffs the user is willing to make.

- Clean up confusing names, dead code, and obsolete helpers only when they are directly involved in the requested change; update their callers.
- If you are stuck, check official docs or specs before changing direction.
- Use subagents for parallel or independent work whenever possible.
- If there is even a 1% chance a skill applies, you must invoke it.

When code is confusing:
1. Simplify it if you can.
2. Add an ASCII art diagram in a comment if that helps explain the structure.

## Context7
Invoke the `find-docs` skill whenever the user asks about a library, framework, SDK, API, CLI tool, or cloud service. Do not invoke it for refactoring, scripts written from scratch, business-logic debugging, code review, or general programming concepts.

## Testing Philosophy

Run the smallest relevant test set that covers the changed behavior. Expand validation when the risk or affected scope warrants it.

Never ask me to run the tests to confirm, run them yourself to confirm.

## Token Efficiency

- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.

## Final Handoff

Before you consider a task done:

1. Confirm all tests or commands you touched actually passed (list them if the user asks).
2. Summarize what changed, with specific file and line references.
3. Call out any TODOs, follow-up work, or uncertainties so I'm never surprised later.
