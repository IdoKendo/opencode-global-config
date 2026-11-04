@test_audit
Feature: Keep tests that detect observable regressions
  Background:
    Given an isolated workspace using the repository agent setup

  Scenario: Prune redundant shipping tests without losing checkout protection
    Given a shipping suite with redundant helper tests and public checkout coverage
    When the user asks the agent to audit and simplify the shipping tests
    Then the redundant shipping suite and its test-only helper are removed
    And the shipping suite protects 5 dollar delivery below 50 and free delivery above 50
    And the agent verified the final shipping suite

  Scenario: Keep delivery migration coverage with the checkout domain
    Given a checkout domain suite missing the exact free delivery threshold
    When the user asks the agent to cover the Copper delivery migration
    Then checkout owns executable coverage for free delivery at exactly 50 dollars
    And the agent verified the final shipping suite

  Scenario: Add the missing free delivery boundary at checkout
    Given checkout tests cover purchases below and above the free delivery threshold
    When the user asks the agent to cover the exact free delivery threshold
    Then the shipping suite passes and detects charging delivery at exactly 50 dollars
    And the agent verified the final shipping suite
