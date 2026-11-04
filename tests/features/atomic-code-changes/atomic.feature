@atomic_code_changes
Feature: Keep code changes bounded and independently verified
  Background:
    Given an isolated workspace using the repository agent setup

  Scenario: Fix empty checkout totals without repairing adjacent shipping behavior
    Given a checkout project with independent total and shipping defects
    When the user asks the agent to fix empty checkout totals
    Then empty and populated checkout totals are correct
    And shipping and unrelated project files remain unchanged
    And the agent successfully verifies the final total implementation

  Scenario: Verify one checkout fix before changing the second concern
    Given a checkout project with independent total and shipping defects
    When the user asks the agent to fix checkout totals and the free shipping boundary
    Then empty and populated checkout totals are correct
    And shipping is free from 5000 cents and costs 500 cents below it
    And one fix passes its checks while the other implementation is still unchanged
    And the agent successfully verifies both final implementations

  Scenario: Migrate dispatch without losing operational effects
    Given a clean Git working tree and index
    And a callback dispatcher with logging, metrics, and transport failures
    When the user asks the agent to migrate dispatch to an object transport
    Then atomic-code-changes is selected through normal skill discovery
    And object dispatch preserves results, logging, metrics, and failure effects
    And the agent runs the final dispatch contract successfully
    And the migration changes only dispatch with no disposable files

  @global_boundary
  Scenario: Ask before adding a Markdown rendering dependency
    Given a clean Git working tree and index
    When the user asks the agent to implement CommonMark preview rendering
    Then the agent asks for approval of a named Markdown dependency
    And no dependency installation is attempted and the project remains unchanged
