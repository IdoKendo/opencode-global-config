@build_the_tool
Feature: Release desk sign-off inventory
  Scenario: Reconcile submitted approvals with each release manifest
    Given the desk shows only green submissions but saffron still lacks a worker approval
    When the user asks the agent to make the desk report release readiness
    Then the current inventory clears cobalt and blocks saffron
    And a new inventory distinguishes full approval from failed, stale, absent and empty evidence
    And a manifest revision changes readiness even when no submission changes
