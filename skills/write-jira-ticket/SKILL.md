---
name: write-jira-ticket
description: Draft high-quality, engineering-focused Jira tickets.
---

# Jira Ticket Writer

## Workflow

1. Collect inputs: ticket type, summary, context, scope, dependencies, risks, constraints.
2. Capture requirement using exactly:
   - Requirement (User Story)
   - `As a <persona>, I want <capability>, so that <value>.`
3. Draft scope with explicit in-scope and out-of-scope bullets.
4. Write Acceptance Criteria (mandatory) as testable pass/fail statements.
5. Write Definition of Done (mandatory) as explicit completion checks.
6. Add dependencies, risks, assumptions, unknowns, labels, and priority.
7. Run the built-in quality gate checklist.
8. Output final ticket in the output template only.

## Guardrails

- Use accurate project metadata (e.g. team name, components, etc) - if unsure, ask.
- No secrets (credentials, keys, tokens, internal sensitive data).
- Separate facts from assumptions.
- Ask for missing critical information before finalizing.
- Bug tickets still require a user-story requirement for the fix outcome.
- Use measurable working in acceptance criteria and definition of done (avoid: "works well", "appropriate", "as needed").

## Quality gate (run before final output)

Check every item; if any fails, request missing data or revise.

- [ ] Ticket type is one of Story/Task/Bug.
- [ ] Summary is specific and outcome-focused.
- [ ] Requirement (User Story) is present and matches exact format.
- [ ] Context/Problem explains why this work is needed.
- [ ] Scope contains explicit In Scope and Out of Scope lists.
- [ ] Definition of Done exists and every item is explicit, testable, and pass/fail.
- [ ] Dependencies/Risks are listed or explicitly marked "None".
- [ ] Assumptions/Unknowns are listed or explicitly marked "None".
- [ ] Suggested labels and priority are provided.
- [ ] Facts vs assumptions are clearly separated.

## Output template (paste-ready)

```markdown
Type: <Story|Task|Bug>

Summary
<one-line summary>

Requirement (User Story)
As a <persona>, I want <capability>, so that <value>.

Context/Problem
<facts only>

Scope
In Scope
- <item>

Out of Scope
- <item>

Acceptance Criteria (mandatory)
- [ ] <explicit pass/fail condition>
- [ ] <explicit pass/fail condition>

Definition of Done (mandatory)
- [ ] <explicit completion check with pass/fail outcome>
- [ ] <explicit completion check with pass/fail outcome>

Dependencies/Risks
- Dependencies: <list or None>
- Risks: <list or None>

Assumptions/Unknowns
- Assumptions: <list or None>
- Unknowns: <list or None>

Suggested labels/priority
- Labels: <label-1>, <label-2>
- Priority: <Highest|High|Medium|Low>
```
