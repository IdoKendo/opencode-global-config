@atomic_code_changes
Feature: Keep code changes bounded and independently verified
  Background:
    Given an isolated workspace using the repository agent setup
    And a checkout project with independent total and shipping defects

  Scenario: Fix empty checkout totals without repairing adjacent shipping behavior
    When the user asks the agent to fix empty checkout totals
    Then empty and populated checkout totals are correct
    And shipping and unrelated project files remain unchanged
    And the agent successfully verifies the final total implementation

  Scenario: Verify one checkout fix before changing the second concern
    When the user asks the agent to fix checkout totals and the free shipping boundary
    Then empty and populated checkout totals are correct
    And shipping is free from 5000 cents and costs 500 cents below it
    And one fix passes its checks while the other implementation is still unchanged
    And the agent successfully verifies both final implementations
