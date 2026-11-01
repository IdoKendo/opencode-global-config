@simplify_code
Feature: Clean up recently modified code
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Clean up pricing changes without changing boundary results
    Given uncommitted pricing changes with redundant nested branches
    When the user asks the agent to clean up the working-tree changes
    Then the agent selects the simplify-code skill normally
    And the changed workflow has less nested control flow
    And pricing preserves zero, negative, threshold, and member results
    And cleanup leaves unrelated code and the Git index and HEAD unchanged

  Scenario: Clean up delivery changes without changing callback effects
    Given uncommitted delivery changes with redundant nested branches
    When the user asks the agent to clean up the working-tree changes
    Then the agent selects the simplify-code skill normally
    And the changed workflow has less nested control flow
    And delivery preserves callback order, identity, and exceptions
    And cleanup leaves unrelated code and the Git index and HEAD unchanged
