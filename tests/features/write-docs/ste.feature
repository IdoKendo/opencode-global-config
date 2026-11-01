@write_docs
Feature: Simplified Technical English for documentation
  Documentation edits use STE without a separate request for the standard.

  Scenario: Edit a procedure with STE vocabulary and short instructions
    Given an isolated workspace using the repository agent setup
    And a procedure with complex vocabulary and a long passive instruction
    When the user asks the agent to improve the procedure
    Then the procedure omits unapproved general verbs and passive instructions
    And each procedure sentence has at most 20 words
    And the procedure retains the backup, button label, and wait time
    And every ordinary prose source line is at most 100 characters
