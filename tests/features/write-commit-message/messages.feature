@write-commit-message
Feature: Explain the value of a change in its commit message
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Describe faster evaluation rather than a worker count
    When the user asks the agent to suggest a commit message for parallel evaluation
    Then write-commit-message is selected through normal skill discovery
    And the commit subject describes faster evaluation
    And the commit suggestion leaves files and Git unchanged

  Scenario: Keep local speed measurements out of unverified CI claims
    When the user asks the agent to write a commit message with local benchmark evidence
    Then write-commit-message is selected through normal skill discovery
    And the commit subject describes faster evaluation
    And the commit message does not turn local measurements into CI results
    And the commit suggestion leaves files and Git unchanged

  Scenario: Report measured CI improvement in the requested message
    When the user asks the agent to write a commit message with verified CI timings
    Then write-commit-message is selected through normal skill discovery
    And the commit subject describes faster evaluation
    And the commit message reports the measured CI reduction
    And the commit suggestion leaves files and Git unchanged
