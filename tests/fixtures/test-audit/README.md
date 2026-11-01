# Test-audit scenario fixtures

These fixtures exercise test cleanup and test authoring through the full repository setup.
The prompts describe local tasks. They do not name the skill or supply its rules.

## Scenario contracts

- `prune`: remove the redundant suite and its test-only helper.
  Keep paid and free delivery protection.
- `boundary`: add coverage for checkout at exactly $50. The original suite covers $49 and $51.

The public checkout boundary owns these contracts. No production injection hook is needed.
The existing documentation scenarios do not test these outcomes.
The cases reject unsafe deletion and an added test that does not detect the missing boundary.

## Checks and controls

`tests/steps/test-audit.mjs:44` runs the resulting suite before each deliberate shipping mutation.
A mutation must cause an assertion failure. Import errors, skipped tests, and baseline failures
cannot satisfy the check. The checker restores the owner in a `finally` block.

The runner records test counts, results, and a digest of the Python files.
The agent must produce a successful receipt for the final files. Checker runs cannot supply it.
The receipts are fixture evidence, not a tamper-proof security boundary.

The family permits changes to `shipping.py` and `tests/` through the existing harness map.
The runner and production checkout caller remain protected by the shared integrity check.
The helper-removal check names an intentionally obsolete seam; it does not inspect source text.

Run the offline controls and focused live scenarios from the repository root:

```sh
node --test tests/controls/test-audit.test.mjs
AGENT_TEST_MODEL=openai/gpt-6-astra npm run test:agents -- --tags @test_audit
```

The shared registration adds two entries in `tests/support/scenarios.mjs:2`.
Feature and step discovery require no other registration changes or dependencies.
This README stays outside the copied scenario inputs.

## Limits

These cases do not cover campaign mode, retention of static compatibility checks,
or baseline defects.
The mutation checks target this small Python fixture, not arbitrary agent-generated projects.
The fixtures require Python 3 as `python`, as does the existing root suite.
