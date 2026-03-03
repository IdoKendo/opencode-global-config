---
description: Commit the changes in the git staging area
agent: orchestrator
---

Have @commit-message-writer write a git commit message for ONLY the staged changes (not the entire branch) and create a commit.

## MANDATORY SEQUENCE OF ACTIONS

1. First have @general check the diff and see which changes are staged.
2. Forward the changed to @commit-message-writer and have him do the following:
    1. Load skill{{ name: "conventional-commits" }} skill and use it to craft a commit message.
    2. Create a local commit.
3. Report what was the message and the reasoning behind it.

## GUARDRAILS
- Do NOT stage any additional files.
- Do NOT push the changes.
