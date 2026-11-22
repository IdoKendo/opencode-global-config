@delete_comment
Feature: Remove comments without losing information
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Remove narration without counting an inline suffix as a deleted line
    Given the export helper is in scope for comment cleanup
    When the user asks the agent to clean up the export helper
    Then the heading helper keeps its literal and loses only its redundant comments
    And the cleanup reports two blocks and two physical lines removed

  Scenario: Keep the compatibility workaround when its issue cannot be recorded
    When the user asks the agent to clean up the compatibility helper offline
    Then the fallback and its retirement condition remain intact
