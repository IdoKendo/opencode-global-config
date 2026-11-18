@test_audit
Feature: Keep independent package entry-point coverage
  Scenario: Remove a repeated rounding check while protecting both public import paths
    Given an isolated workspace using the repository agent setup
    And a rounding package tested twice through its root and once through its SDK
    When the user asks the agent to clean up the rounding tests
    Then the rounding example runs only once through each public path
    And the suite detects a wrong result at either path independently
