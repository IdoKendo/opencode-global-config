---
name: build-the-tool
description: >-
  Use when creating reusable scripts, validators, or evidence gates, and for edits, migrations,
  analyses, or checks where repeatable automation materially improves correctness or verification.
  Reuse an existing tool or build the smallest rerunnable check.
---

# Build the Tool

Prefer an existing tool or reproducible command. Build the smallest missing tool only when
automation improves correctness or verification. Small edits and judgment-heavy reviews do not
require a script.

- Complete one unit manually. Compare the tool's output on that unit with the manual result.
  Make repeated runs safe.
- For analysis and checks, establish expected results independently of the tool.
  Verify valid, invalid or boundary, and incomplete inputs. Failures and missing evidence must not
  appear successful.
- Run the tool yourself when it can process the batch. Do not delegate manual repetition.
  When delegation is useful, give all delegates one shared skill with the procedure, verification
  requirements, and scope boundaries. Keep that skill outside their write scope.
- In the handoff, give the rerunnable command, input paths, and actual results.
  Report valid, invalid, and incomplete evidence results separately.
  State what still needs human judgment or production verification.
- Keep disposable artifacts outside the repository.
  Add durable files only when future work needs them.
