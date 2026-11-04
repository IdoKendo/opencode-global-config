# Agent integration tests

Run the repository's agent configuration against isolated task fixtures.
[Features](features/) define the expected behavior; [controls](controls/) check the assertions.

## Run locally

Run from the repository root with its npm dependencies installed, Node.js, Git, and a POSIX shell.
See [package.json](../package.json) and the
[CI setup](../.github/workflows/quality-gates.yml) for dependencies and runtime versions.

```sh
# Check assertions without model calls.
npm run test:agents:controls

# Check scenario discovery and step bindings.
npm run test:agents -- --dry-run

# Run live scenarios with a model available to your account.
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents
```

Live runs need OpenCode V2 on `PATH`, authenticated provider access,
and any configured integrations.
They use real credentials and incur normal model usage. Replace the example model as needed.
A dry run checks bindings; it does not test agent behavior.

Use `--tags` or `--name` to select cases.
Find their current values in the [feature files](features/).
The npm command definitions live in [package.json](../package.json).

## Test sources

| Source | Purpose |
| --- | --- |
| [features/](features/) | Scenarios and tags, grouped by skill |
| [fixtures/](fixtures/) | Task inputs and executable checks |
| [steps/](steps/) | Step definitions and assertions |
| [controls/](controls/) | Positive and negative tests of the assertions |
| [support/scenarios.mjs](support/scenarios.mjs) | Scenario names, task prompts, and fixture mappings |

## Add or update a scenario

Use Node.js for executable fixtures and checks. Do not add another language runtime.

1. Add the scenario and its supporting files to the owning skill suite, following nearby examples.
2. Register its exact name, task prompt, and fixtures in the [scenario map](support/scenarios.mjs).
3. Reuse or extend the fixtures and step definitions.
   Keep expected outcomes out of the agent prompt.
4. Add positive and negative controls for new assertions, then run the relevant checks.

## Runtime and evidence

The [harness](support/harness.mjs) defines configuration, environment settings, execution, and
artifact handling. [Lifecycle hooks](support/hooks.mjs) connect it to Cucumber.
Use the artifact path printed by the runner to inspect results and traces.

The harness links the current repository configuration into temporary workspaces
(`support/harness.mjs:13`). Keep that configuration stable during a run.
Task files are isolated; configured tools and credentials remain available.

## Continuous integration

- [Quality Gates](../.github/workflows/quality-gates.yml): offline controls and binding checks.
- [Agent Evaluation](../.github/workflows/agent-evaluation.yml): live runs and uploaded evidence.
  See its inputs, secrets, variables, and steps for model selection, runtime versions, MCP settings,
  and artifact retention.
