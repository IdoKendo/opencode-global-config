@learn-from-feedback
Feature: Turn feedback into durable safeguards
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Suggest an existing lint rule after one correction
    When the user asks the agent to respond to the console logging correction
    Then learn-from-feedback is selected through normal skill discovery
    And the feedback recommendation enables the existing console rule
    And the feedback analysis leaves the workspace and Git history unchanged

  Scenario: Repair the execution gap instead of duplicating a configured rule
    When the user asks the agent to read the console logging review thread
    Then learn-from-feedback is selected through normal skill discovery
    And the feedback recommendation repairs the missing lint invocation
    And the feedback analysis leaves the workspace and Git history unchanged

  Scenario: Put judgment feedback in the existing skill without adopting a disputed ban
    When the user asks the agent to respond to the investigation review
    Then learn-from-feedback is selected through normal skill discovery
    And the feedback recommendation improves investigation guidance and preserves the exception
    And the feedback analysis leaves the workspace and Git history unchanged
