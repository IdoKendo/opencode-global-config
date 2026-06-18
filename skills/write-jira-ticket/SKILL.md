---
name: write-jira-ticket
description: Draft high-quality, engineering-focused Jira tickets.
---

# Jira Ticket Writer

## Purpose

- Draft clear, implementation-ready Jira tickets for engineering work.
- Produce deterministic, paste-ready markdown for Jira descriptions.
- Enforce required structure and quality checks before final output.

Ticket types: Story, Task, Bug

## Scope

Use when you need to create or refine a Jira ticket that engineers can execute with minimal ambiguity.

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

## Examples

### Story example

Summary
Add pagination to audit log API for faster timeline loading

Requirement (User Story)
As a compliance analyst, I want paginated audit log results, so that I can review long timelines without timeouts.

Context/Problem
Current endpoint returns full history, causing high latency and occasional gateway timeouts on large tenants.

Scope (in/out)
In Scope
- Add `page` and `pageSize` query params with defaults.
- Return pagination metadata (`total`, `page`, `pageSize`).

Out of Scope
- Frontend pagination UI changes.
- Historical data backfill.

Acceptance Criteria
- [ ] Given more than one page of logs, when `page=2&pageSize=50`, then exactly 50 records for page 2 are returned.
- [ ] Given invalid `pageSize` (>200), when request is sent, then API returns HTTP 400 with validation error.

Definition of Done
- [ ] Unit tests for pagination parameter validation pass.
- [ ] Integration test verifying deterministic ordering across pages passes.
- [ ] API docs include pagination params and response metadata.

Dependencies/Risks
- Dependencies: Existing query builder supports offset/limit.
- Risks: Query performance regression on unindexed tenant filters.

Assumptions/Unknowns
- Assumptions: Audit log table has stable timestamp + id ordering.
- Unknowns: Peak tenant row counts in production this quarter.

Suggested labels/priority
- Labels: backend, api, audit-log
- Priority: High

### Task example

Summary
Upgrade CI runner image to Node 22 LTS

Requirement (User Story)
As a platform engineer, I want CI jobs running on Node 22 LTS, so that builds stay aligned with supported runtime versions.

Context/Problem
Current runner image uses Node 20 and misses runtime parity with services already upgraded to Node 22.

Scope (in/out)
In Scope
- Update runner base image tag.
- Update pipeline cache key to include Node major version.

Out of Scope
- Application code migrations unrelated to CI runtime.

Acceptance Criteria
- [ ] CI pipeline runs on Node 22 and reports runtime version in logs.
- [ ] Build, lint, and test jobs complete successfully on default branch.

Definition of Done
- [ ] Runner image tag update merged and deployed.
- [ ] Pipeline documentation updated with new runtime version.
- [ ] One successful production-equivalent pipeline run is linked in the ticket.

Dependencies/Risks
- Dependencies: Base image `company/ci-node:22` published.
- Risks: Native module rebuild time may increase.

Assumptions/Unknowns
- Assumptions: All repos in scope are Node 22 compatible.
- Unknowns: Any hidden Node 20-only tool plugins.

Suggested labels/priority
- Labels: platform, ci, maintenance
- Priority: Medium

### Bug example

Summary
Fix duplicate invoice generation on retry after payment timeout

Requirement (User Story)
As a billing operator, I want invoice generation retries to be idempotent, so that customers are never charged or invoiced twice.

Context/Problem
When payment provider timeout occurs, retry path creates a second invoice row before webhook reconciliation completes.

Scope (in/out)
In Scope
- Add idempotency key check in retry path.
- Prevent second invoice creation when matching key exists.

Out of Scope
- Payment provider SLA changes.
- Rework of full billing architecture.

Acceptance Criteria
- [ ] Given a timeout followed by retry with same idempotency key, exactly one invoice record exists.
- [ ] Given retry with a different idempotency key, a new invoice record is created.

Definition of Done
- [ ] Regression test reproducing duplicate-invoice scenario fails before fix and passes after fix.
- [ ] Monitoring alert threshold for duplicate invoice events set to zero and validated in staging.
- [ ] Runbook includes idempotency key troubleshooting step.

Dependencies/Risks
- Dependencies: Access to payment retry logs for verification.
- Risks: False positives if legacy records have missing idempotency keys.

Assumptions/Unknowns
- Assumptions: Retry requests always carry stable idempotency keys.
- Unknowns: Percentage of legacy records without key population.

Suggested labels/priority
- Labels: bug, billing, reliability
- Priority: Highest
