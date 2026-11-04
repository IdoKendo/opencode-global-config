@write_docs
Feature: Test suite documentation structure
  Maintainers can find sources and run the suite without a second copy of its specification.

  Background:
    Given an isolated workspace using the repository agent setup
    And a clean Git working tree and index

  Scenario: Replace a copied suite inventory with authoritative maintenance guidance
    Given a runnable document-check suite with a copied scenario inventory in its guide
    When the user asks the agent to improve the test suite maintenance guide
    Then the suite guide links to existing behavior, runner, configuration, and command sources
    And the suite guide gives a working command from the project root
    And suite maintenance prose does not duplicate scenario inventories, counts, or source details

  Scenario: Tidy redundant suite guides into one maintenance entry point
    Given a document-check suite with redundant fixture guidance
    When the user asks the agent to tidy the test suite documentation structure
    Then the suite has one maintenance entry point without redundant nested guides
    And the suite guide links to existing behavior, runner, configuration, and command sources
    And the suite guide gives a working command from the project root
