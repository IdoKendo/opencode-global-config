@review-change
Feature: Review requirements independently from code quality
  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Distinguish a missing shipping boundary from a receipt logging violation
    Given a staged receipt change and an unstaged shipping boundary change
    When the user asks the agent to review the working-tree changes
    Then the review selects review-change from the ordinary request
    And requirements identify the missing free shipping boundary
    And code quality identifies the receipt logging standard violation
    And the review preserves every file and the Git state

  Scenario: Continue quality review when the original request is unavailable
    Given a staged receipt change and an unstaged shipping boundary change
    When the user asks the agent to review the working-tree changes
    Then the review selects review-change from the ordinary request
    And requirements are unavailable rather than passed
    And code quality identifies the receipt logging standard violation
    And the review preserves every file and the Git state
