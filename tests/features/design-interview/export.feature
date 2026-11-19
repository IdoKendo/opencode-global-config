@design-interview
Feature: Decide what happens when an export already exists
  Background:
    Given the export contract fixes CSV as the format and Downloads as the destination

  Scenario: Ask about the filename collision before changing the exporter
    When the user asks the agent to run a design interview about repeated exports
    Then the requested design-interview skill is loaded
    And the agent asks one question about handling the existing file
    And the interview leaves the workspace and Git unchanged

  Scenario: End the interview with the copy policy settled and naming still open
    When the user asks the agent to close the interview after choosing Keep both and deferring the suffix
    Then the requested design-interview skill is loaded
    And the brief confirms Keep both and leaves the suffix undecided
    And the interview leaves the workspace and Git unchanged
