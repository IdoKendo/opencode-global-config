# Agent integration tests

This root suite runs the full repository setup on eight documentation tasks in isolated workspaces.
It evaluates generated files, final handoffs, tool traces, and actual fixture-command execution.

## Prerequisites

- Node.js supported by Cucumber.js 13: Node 22, 24, or 26 and later. Locally tested on Node 24.
- Repository npm dependencies installed with `npm install`.
- Python 3 available as `python`, Git, and a POSIX shell. Windows is not supported by this harness.
- OpenCode V2 on `PATH`, with a working authenticated model provider. Tested with OpenCode 2.1.4.
- An explicit `AGENT_TEST_MODEL` value in `provider/model` format, optionally including `#variant`.
- External skill paths, services, and credentials required by the actual repository configuration.

Model calls use your provider credentials and incur normal usage. The repository configuration,
including configured providers and MCP settings, remains available. Local-only, uncommitted settings
do not enter a CI checkout.

## Run locally

Run these commands from the repository root.

Check the deterministic positive and negative controls without calling a model:

```sh
npm run test:agents:controls
```

Check Gherkin parsing and step binding without running the scenarios:

```sh
npm run test:agents -- --dry-run
```

Run all eight scenarios against an explicit model:

```sh
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents
```

Select the documentation behavior family, or just its wrapping scenario:

```sh
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents -- --tags @write_docs
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents -- --name 'Wrap prose'
```

Include a machine-readable Cucumber report:

```sh
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents -- \
  --format json:logs/agent-tests/report.json
```

Failed assertions, undefined steps, setup errors, and model failures produce a nonzero exit status.
A dry-run reports skipped steps; it does not establish behavioral correctness. Cucumber skips later
steps after a scenario failure, so inspect both the failing assertion and saved output.

## Suite layout and extension points

```text
tests/
  features/write-docs/       # Gherkin workflows tagged @write_docs
  fixtures/write-docs/       # Input documents and executable fixtures
  steps/write-docs.mjs       # Documentation step definitions and assertions
  steps/setup.mjs            # Shared setup assertions
  support/
    harness.mjs             # Full-setup linking, agent execution, and evidence
    hooks.mjs               # Scenario lifecycle and cleanup
    scenarios.mjs           # Scenario names mapped to inputs and prompts
  controls/
    write-docs.test.mjs      # Positive and negative assertion controls
    harness.test.mjs         # Harness controls without live models
```

To add a behavior family, create `features/<family>/` and `fixtures/<family>/`, then add step
definitions in `steps/<family>.mjs`. Tag its features so runs can select that family. Register each
scenario's exact name in `support/scenarios.mjs` with a `fixture` path relative to `tests/fixtures`,
optional `includes` paths for shared inputs, and a task-focused `prompt`. Shared inputs are copied
first, then the scenario fixture. Keep expected outcomes in features and assertions rather than
injecting them into prompts. Add deterministic controls for new checkers under `controls/`.
See `tests/support/scenarios.mjs:1` for the existing registration pattern.

## Configuration and artifacts

| Environment variable | Purpose | Default |
| --- | --- | --- |
| `AGENT_TEST_MODEL` | Explicit model reference | Required for live runs |
| `AGENT_TEST_TIMEOUT_MS` | Maximum agent process duration per scenario | `180000` |
| `AGENT_TEST_TMPDIR` | Existing parent directory for temporary workspaces | OS temporary directory |
| `AGENT_TEST_ARTIFACTS` | Parent directory for per-scenario evidence | `logs/agent-tests` |
| `AGENT_TEST_RECEIPTS` | Fixture receipt path, set only for agent runs | Harness-managed |

Each scenario saves a unique artifact directory containing:

- `metadata.json`: scenario, prompt, timeout, `setupRoot`, `setupRevision`, `setupDirty`, `model`,
  and `opencodeVersion`.
- `trace.jsonl` and `stderr.txt`: raw agent output and diagnostics, including runtime tool use and
  selected skills in the trace.
- `executions.jsonl`: worker invocation arguments and exit codes recorded during the agent run.
- `result.json`: Cucumber result, including assertion failures.
- `workspace/`: generated documents and fixture files, excluding `.git`.
- `diff.patch`: tracked changes against the temporary baseline; new files are in `workspace/`.

There is no `SKILL.md` snapshot or skill hash. Metadata identifies the live repository, not a frozen
configuration. See `tests/support/harness.mjs:151` for metadata fields.
Some files can be absent when setup or execution fails early. Artifacts survive temporary-workspace
cleanup. The default `logs/` directory is ignored by Git; no artifacts are committed automatically.

## How isolation and evidence work

The harness copies only the selected inputs into a new Git repository and creates a baseline commit
there. The harness never stages or commits the working repository. Setup commands run before the
agent and cannot create execution receipts that satisfy agent-verification assertions.

The temporary `XDG_CONFIG_HOME/opencode` symlinks to the actual repository root. The unmodified
global setup remains available: `AGENTS.md`, all automatically discovered and configured skills,
agents, plugins, permissions, and MCP settings. The agent selects skills normally; write-docs is
not injected. External paths and credentials must work as they do for the actual configuration.
See `tests/support/harness.mjs:13` for setup linking.

Each invocation uses a standalone OpenCode process, the explicit test model, and `--auto`.
Prompts specify tasks rather than repeating skill rules. `PWD` matches the fixture workspace,
stdin is closed, and `DEPLOY_TOKEN` is removed. Caller `OPENCODE_*` overrides are cleared rather
than inherited as another configuration layer. Feature expectations are not copied into fixtures.
See `tests/support/harness.mjs:108` and `tests/support/harness.mjs:172`.

The final handoff is extracted after the last tool interaction. Intermediate plans cannot satisfy
handoff assertions. Worker receipts prove actual invocation even when an agent verifies commands
through a subprocess loop that prints only `PASS`. Non-document fixture bytes and permissions must
remain unchanged, preventing implementation edits from changing the verification oracle.

## Coverage and limitations

The scenarios cover line wrapping, protected constructs, concise prose, facts and caveats, project
conventions, related-document updates, unrelated drift, successful and blocked verification, and
final Git state. The offline controls exercise both valid outputs and deliberate violations, plus
process timeout, stdin EOF, trace completeness, runtime receipts, and implementation integrity.

Semantic checks are bounded heuristics for these fixtures, not general language understanding.
Clarity, usefulness, and tone still need human review. The Markdown checks cover these fixtures,
not the entire Markdown grammar. Git checks establish final HEAD and index state, not the absence
of every transient staging operation. Runtime receipts are not adversarial tamper-proof evidence.

The current eight workflows exercise the full setup, not every skill, agent, plugin, or MCP
integration. Runtime traces help explain tool and skill selection. CLI runs do not cover the
interactive TUI. Fixture workspaces isolate task files, not configuration capabilities or OS access.
The repository is linked live, with no configuration snapshot; edits during a run can affect it.
Machine-managed OpenCode policies can still affect execution. Model behavior varies; a fixed model
reference does not guarantee deterministic outputs.

## Continuous integration

`.github/workflows/quality-gates.yml` runs **Agent test controls** on pull requests and pushes to
`main`. The hosted Ubuntu job installs Node 26 and Python 3.12, runs the offline controls, and
checks all feature bindings. It requires no model credentials. To enforce it for merges, select
this check in the repository's branch protection settings.

`.github/workflows/agent-evaluation.yml` runs the live suite manually and, when enabled, on pushes
to `main` on GitHub-hosted `ubuntu-latest` runners, with OpenCode pinned to 2.1.4. All behavior
families run; the workflow is not limited to write-docs or changes within one skill.

### Enable live evaluation

1. In **Settings → Secrets and variables → Actions → Secrets**, add `OPENAI_API_KEY` with an OpenAI
   API key that has access to the selected model. No saved OpenCode or MCP login is needed.
2. Run **Agent Evaluation** from GitHub Actions with an explicit `openai/...` model. The default is
   `openai/gpt-6-astra`; select a model available to your API account.
3. Set the repository Actions variable `AGENT_TEST_LIVE_ENABLED` to `true` to enable pushes to
   `main`. Optionally set `AGENT_TEST_MODEL` to change the model for automatic runs.

CI sets `disabled: true` on every server in the checked-out `opencode.json` before evaluation. Other
configuration remains intact, including repository instructions, skills, agents, and plugins.
This temporary checkout edit is not committed and does not change local MCP settings. It also means
CI does not cover MCP tools or server-provided instructions; local full-setup runs still can.

The workflow supplies OpenAI credentials only and fails early if the secret is missing or a
different provider is selected. The API key is passed only to the credential check and evaluation
steps.
No self-hosted runner or external skills checkout is required for the committed setup. The CLI is
installed under the runner's temporary directory. Metadata reports a dirty setup because of the
intentional MCP override, and the job summary identifies the MCP-disabled profile.

Live jobs have a 35-minute limit and retain the per-scenario 180-second agent timeout. Runs are
serialized. The evaluation step is informational: behavioral failures appear in the job summary and
as a warning, while dependency/setup failures fail the job. Evidence uploads run even after failure,
with seven-day retention. A run that fails before producing evidence may have no artifact.

Download the `agent-evaluation-<run>-<attempt>` artifact for `report.json`, generated documents,
runtime receipts, and traces. Review these before attributing a failure to the setup, model,
fixture, or checker. Do not treat an informational workflow's green status as proof that every
scenario passed.
