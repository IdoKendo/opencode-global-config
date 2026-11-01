@build_the_tool
Feature: Repeatable migrations and evidence checks
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Migrate service timeouts with a reusable safe tool
    Given a batch of service timeouts in seconds and one migrated service
    When the user asks the agent to migrate the service batch
    Then the agent selects build-the-tool through normal skill discovery
    And the current service batch has millisecond timeouts and preserves other values
    And the migration handles new services and a second run changes no bytes
    And the agent ran the final tool against the task inputs
    And the tool task stays in scope with an empty index and unchanged HEAD

  Scenario: Check release evidence without treating missing checks as success
    Given release r7 evidence with complete, failed, and missing checks
    When the user asks the agent to implement the release evidence gate
    Then the agent selects build-the-tool through normal skill discovery
    And the release check accepts complete evidence and rejects invalid or incomplete evidence
    And the agent ran the final tool against the task inputs
    And the tool task stays in scope with an empty index and unchanged HEAD
    And the tool handoff identifies its command, result, and remaining release limitation
