# Write-docs scenario fixtures

These inputs belong to the documentation behavior family of the root agent integration suite.
They include deliberate errors and overlong Markdown lines. Do not reformat or correct them as
ordinary project documentation. Expected outcomes remain in `tests/features/write-docs/`.

## Scenario mapping

| Scenario | Fixture directory |
| --- | --- |
| Document behavior and an edge case using project conventions | `documentation/conventions` |
| Update affected documentation and report unrelated drift | `documentation/drift` |
| Correct a broken example using execution evidence | `documentation/broken-example` |
| Report an example that cannot be verified | `documentation/blocked-verification` |
| Make an authorized documentation edit without staging or committing | `documentation/guardrails` |
| Wrap prose without shortening it or changing list structure | `formatting/wrapping` |
| Preserve constructs that wrapping would break | `formatting/protected-constructs` |
| Remove filler while preserving technical facts and caveats | `formatting/concise` |

## Workspace setup contract

Copy the contents of the selected directory into a fresh temporary workspace. For worker scenarios,
also copy `documentation/common/worker.py` to the workspace root. The deployment scenario uses only
its own files. Preserve the executable permission on `deploy.sh`.

The worker requires Python 3 available as `python`, matching the scenario commands. It accepts
positive integer attempt counts, defaults to 5, and rejects the obsolete `--retry` option. The drift
fixture represents the state after the default changed from 3 to 5; no historical checkout is
needed. The installer referenced in that fixture is intentionally absent.

For blocked verification, remove `DEPLOY_TOKEN` from the agent environment even if the host has it.
The deployment script is a local fixture: it never contacts a service or deploys anything. It
rejects placeholder tokens because no deployment service is available to validate them.

The harness establishes a clean Git baseline after copying inputs and records the baseline HEAD
before invoking the agent. The temporary `XDG_CONFIG_HOME/opencode` links to the actual repository
root, preserving its full global setup. The agent selects skills normally; write-docs is not
injected. This README, other fixtures, and feature expectations are not copied into the workspace.
The linked repository remains accessible; workspace isolation is not a security sandbox.

Fixture registration lives in `tests/support/scenarios.mjs:1`: each scenario names a `fixture`,
optional shared `includes`, and a task-focused `prompt`. Paths are relative to `tests/fixtures`.
Step definitions live in `tests/steps/write-docs.mjs`; use `@write_docs` to select this family.

The worker can write fixture-only execution receipts when `AGENT_TEST_RECEIPTS` is set. The harness
enables this only for the agent invocation, not setup checks. See [the suite guide](../../README.md)
for run commands, prerequisites, configuration limits, and the evidence contract.
