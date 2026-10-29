@write_docs
Feature: Documentation grounded in code and verified examples
  The agent writes accurate documentation within the requested scope and reports its evidence.

  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Document behavior and an edge case using project conventions
    Given a project with a runnable "python worker.py --attempts N" command
    And the command accepts positive integers and rejects 0 with "attempts must be positive"
    And existing guides use sentence-case headings and sections named "Usage" and "Examples"
    When the user asks the agent to document the attempts option with examples for 3 and 0
    Then the guide uses sentence-case headings and "Usage" and "Examples" sections
    And it explains the positive-integer restriction before giving examples
    And it includes examples with "--attempts 3" and "--attempts 0"
    And the zero-attempt example documents the error "attempts must be positive"
    And command examples appear in syntax-highlighted code blocks
    And source references use file paths and line numbers that locate the documented behavior

  Scenario: Update affected documentation and report unrelated drift
    Given the worker's default retry count has changed from 3 to 5
    And "README.md" and "docs/retries.md" still describe the default as 3
    And "docs/install.md" names a removed installer command unrelated to retry behavior
    When the user asks the agent to update "README.md" for the new retry default
    Then "README.md" and "docs/retries.md" describe the default as 5
    And "docs/install.md" is unchanged
    And the handoff identifies the removed installer command in "docs/install.md" as drift

  Scenario: Correct a broken example using execution evidence
    Given "docs/usage.md" recommends "python worker.py --retry 3"
    And that command exits with an unknown-option error
    And the implementation accepts "python worker.py --attempts 3"
    When the user asks the agent to verify and fix the usage guide
    Then the guide recommends "python worker.py --attempts 3"
    And the agent executes the corrected command successfully
    And the handoff identifies the corrected option and the successful verification

  Scenario: Report an example that cannot be verified
    Given a deployment guide containing the command "./deploy.sh --dry-run"
    And that command requires DEPLOY_TOKEN which is unavailable in the workspace
    When the user asks the agent to verify the deployment guide
    Then the handoff identifies "./deploy.sh --dry-run" as unverified
    And it states that the missing DEPLOY_TOKEN blocks verification
    And it does not claim that deployment verification passed

  Scenario: Make an authorized documentation edit without staging or committing
    Given "docs/retries.md" incorrectly describes the default retry count as 3
    And the implementation sets the default retry count to 5
    When the user asks the agent to correct the documented retry default
    Then "docs/retries.md" describes the default retry count as 5
    And the agent does not ask for confirmation before editing
    And the Git index remains empty
    And the Git HEAD is unchanged
    And the handoff identifies the edited file and the implementation evidence checked
