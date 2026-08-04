---
name: find-skills
description: Discovers installable agent skills when the user explicitly asks to find, compare, recommend, or install a skill, or explicitly asks how to extend the agent's capabilities. Do not trigger for ordinary requests that can be handled directly.
---

# Find Skills

## What is the Skills CLI?

The Skills CLI (`npx skills`) is the package manager for the open agent skills ecosystem. Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools.

**Key commands:**

- `npx skills find [query]` - Search for skills interactively or by keyword
- `npx skills add <package>` - Install a skill from GitHub or other sources
- `npx skills check` - Check for skill updates
- `npx skills update` - Update all installed skills

**Browse skills at:** https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

When the user explicitly requests skill discovery or installation, identify:

1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Search Current Sources

Search the current catalog for task-specific candidates. Leaderboard position and install count are discovery signals only; do not describe a skill as trustworthy or battle-tested based on popularity alone.

### Step 3: Search for Skills

Run the find command with task-specific terms:

```bash
npx skills find [query]
```

For example:

- User asks "find a skill for React performance" → `npx skills find react performance`
- User asks "recommend a PR review skill" → `npx skills find pr review`
- User asks "is there a changelog skill?" → `npx skills find changelog`

### Step 4: Assess Current Evidence Before Recommending

Do not recommend a skill from search ranking alone. At recommendation time:

1. Read the exact skill instructions being recommended.
2. Verify the repository and publisher identity; describe official affiliation only when documented.
3. Check current maintenance evidence such as recent commits, releases, compatibility notes, and issue handling.
4. Review scripts, dependencies, permissions, and instructions for security-sensitive behavior.
5. Report observed evidence with links or dates, distinguish facts from inference, and identify unknowns.

Install counts and stars may be reported as current popularity signals, but do not use fixed thresholds as quality guarantees.

### Step 5: Present Options to the User

When you find relevant skills, present them to the user with:

1. The skill name and what it does
2. The exact source and current maintenance evidence
3. Relevant permissions, dependencies, risks, and unknowns
4. A source or catalog link

### Step 6: Request Installation Consent

Do not install a skill until the user explicitly approves the exact skill and source, project-local or global scope, and command to run. Use project-local scope unless the user explicitly chooses global scope. Do not pass `-y`; preserve the CLI confirmation prompt.

```bash
# Project-local
npx skills add <owner/repo@skill>

# Global, only with explicit approval
npx skills add <owner/repo@skill> -g
```

## Common Skill Categories

When searching, consider these common categories:

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

## Tips for Effective Searches

1. **Use specific keywords**: "react testing" is better than just "testing"
2. **Try alternative terms**: If "deploy" doesn't work, try "deployment" or "ci-cd"
3. **Verify current sources**: Check publisher identity, maintenance, and the exact skill contents before recommending.

## When No Skills Are Found

If no relevant skills exist:

1. Acknowledge that no existing skill was found
2. Offer to help with the task directly using your general capabilities
3. Suggest the user could create their own skill with `npx skills init`

Example:

```
I searched for skills related to "xyz" but didn't find any matches.
I can still help you with this task directly! Would you like me to proceed?

If this is something you do often, you could create your own skill:
npx skills init my-xyz-skill
```
