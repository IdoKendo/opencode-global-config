@shape_output
Feature: Responses matched to the reader's next decision
  Background:
    Given an isolated workspace using the repository agent setup

  Scenario: Give ordered guidance for a local archive rehearsal
    Given the rehearsal requires creating, checking, and moving a local archive
    When the user asks the agent to explain how to carry out the rehearsal
    Then shape-output is selected through normal skill discovery
    And the response gives numbered archive actions in dependency order
    And the response starts with useful guidance and ends without pleasantries

  Scenario: Reset diagnosis after three unsuccessful fixes
    Given three retry changes have failed to resolve the upload error
    When the user asks the agent to continue troubleshooting
    Then shape-output is selected through normal skill discovery
    And the response questions the transient-error assumption and asks one diagnostic question
    And the response starts with useful guidance and ends without pleasantries

  Scenario: Answer a retention fact without manufacturing work
    Given rehearsal archives have a 14-day retention policy
    When the user asks the agent to give the retention period
    Then the response answers 14 days without inventing actions or estimates
    And shape-output is not selected for the factual answer

  Scenario: Deliver a performance change description with measured evidence and blocked checks
    Given a clean Git working tree and index
    When the user asks the agent to write a paste-ready Markdown change description
    Then shape-output is selected through normal skill discovery
    And the response is a complete Markdown change description with local performance evidence
    And the change description names the missing CI and production credentials without claiming success
    And the shared change description uses platform-neutral terminology

  Scenario: Preserve GitLab MR terminology when explicitly requested
    Given a clean Git working tree and index
    When the user asks the agent to write a paste-ready GitLab MR description with an MR description heading
    Then shape-output is selected through normal skill discovery
    And the response is a complete Markdown change description with local performance evidence
    And the change description names the missing CI and production credentials without claiming success
    And the requested GitLab description preserves the MR description heading
