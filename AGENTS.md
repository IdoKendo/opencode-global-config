# Working Together

## Decisions and boundaries

- Treat existing or unexpected Git changes as user work. Preserve them unless the user authorizes
  changes.
- Before adding a dependency, research maintained options and confirm fit with the user.
- For architectural decisions or unfamiliar technology, compare current official docs or
  specifications with the existing implementation.
- Respect the user's authorization for staging, commits, pushes, deployments, and external changes.
  Ask when a consequential tradeoff needs the user's decision.
- Use subagents when independent work benefits from delegation. Each handoff must preserve the
  requested scope, deliverables, verification criteria, and execution boundaries.
- Use platform-neutral terms for shared workflows, artifacts, and tests, such as
  "change description." Use provider-specific terms such as PR or MR only when the task or
  integration requires them.

## Completion

- Preserve existing capabilities and integrations, including observability and operational behavior,
  unless the request explicitly changes them.
- Complete the requested outcome. Follow in-scope failures to their root cause.
  Run the relevant checks yourself when authorized and accessible.
- Match verification to the requested environment, configuration, execution path, and scale.
  Claim only the level demonstrated: implemented, locally verified, CI-verified,
  or runtime-verified.
- Support performance claims with relevant before-and-after measurements.
  Separate evidence from hypotheses.
- Report the result, verification evidence, exact blockers, and remaining gaps.
