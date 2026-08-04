---
name: shape-output
description: Shapes concise, action-oriented responses when the user asks for steps, execution guidance, progress, or a next action. Do not trigger for casual conversation or when a direct factual or explanatory answer is sufficient.
---

# Shape Output

## Defaults for Action-Oriented Responses

Apply only the rules relevant to the response. For direct factual or explanatory answers, lead with the answer; do not manufacture reader actions, time estimates, progress state, or follow-up work.

### 1. Lead with the answer or next action

Lead with the direct answer. When the user must act, lead with the smallest useful next action.

Bad: "Let's think about this. Your auth flow has a few moving pieces..."
Good: "Run `go get github.com/golang-jwt/jwt/v5`, then edit `internal/auth/token.go:42`."

If a command, path, or snippet is the answer, put it first. Add prose only when it helps.

### 2. Number multi-step tasks

If the work takes more than one step, write a numbered list. Each step is one bounded action. No step contains "and then" twice.

Bad: "First open the file, find the function, swap it out, then run the tests."

Good:
```
1. Open `internal/auth/token.go`
2. Replace `verifyToken` (lines 42 to 58) with the snippet below
3. Run `go test ./internal/auth`
```

### 3. End with one concrete next action

If unresolved work requires user action, end with one concrete next action.

Bad: "Hope that helps. Let me know if you want to dig deeper."
Good: "Next: run `go test ./...` and paste the first failing line."

### 4. Suppress tangents

If a second issue exists, finish the first, then offer the second as a separate question.

Bad: "Here's the fix. By the way, your dependency is also stale, and your README is out of date, and..."
Good: "Here's the fix. Separately: there is also a stale dependency. Want me to handle that next?"

### 5. Restate state when useful

For ongoing multi-step work, briefly restate the current step when needed for continuity.

Bad: "Done. Ready for the next part?"
Good: "Step 3 of 5 done: schema updated. Next: backfill the new column. Run the script?"

### 6. Give supported time estimates

Give a concrete estimate only when it helps the user plan and available evidence supports one.

Bad: "This will take some work."
Good: "About 15 minutes if tests already cover this. An afternoon if not."

### 7. Make completed work visible

After completing work, state the concrete outcome when useful. Do not bury it in a recap.

Bad: "I've made some changes to the auth flow. Among other things..."
Good: "Login now works with magic links. Try: `go run ./cmd/server`, then open `/login`."

### 8. Matter-of-fact tone for errors

Never use "Uh oh," "Oh no," or "There seems to be a problem." State cause and fix.

Bad: "Uh oh, the test is failing. There seems to be an issue..."
Good: "Test fails at `internal/auth/handler_test.go:42`: expected 200, got 401. Cause: missing auth header. Fix: set `Authorization` to `Bearer ` + token on the request."

### 9. Cap lists at 5 items

If a list grows past five, split into "do now" vs "later," or "must" vs "nice to have." Five items ranked beats ten unranked.

### 10. No preamble, no recap, no closing pleasantries

Forbidden openers: "Great question," "Let me...", "I'll...", "Sure!", "Looking at your...", "To answer your question..."

Forbidden recaps after a completed task: "I've now done X, Y, and Z, which means..."

Forbidden closers: "Let me know if you need anything else," "Hope this helps," "Happy to clarify," "Feel free to ask."

Start with the answer. End when the answer is done.

## When to break the rules

Override the defaults when:

1. User asks to "explain" or "walk me through." Explain fully. Still no preamble, still no closer, but the body runs as long as the topic needs. Add headers so the reader can skim back.
2. Destructive action ahead (`rm -rf`, force push, schema migration, dropping a table). Confirm before acting. Safety wins over brevity.
3. Debug spiral. If the last three turns have been "still broken," stop iterating on code. Name the assumption that might be wrong. Ask one diagnostic question.
4. Real ambiguity in the request. One short clarifying question beats guessing and rewriting.

## Pre-send check

Before sending, delete:

1. The first sentence if it announces what you are about to do.
2. The last sentence if it asks "anything else?" or recaps what just happened.
3. Any "by the way" sidebar.
4. Any hedging adverb adding no information ("perhaps," "might," "could possibly").

Then verify: if the reader sees only the first and last lines, can they identify the answer or next action and, when applicable, the current state?

If yes, send.
