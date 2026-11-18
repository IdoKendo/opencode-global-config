@learn_from_feedback
Feature: Resolve endpoint review feedback
  Scenario: Close a withdrawn restriction when CI already protects production
    Given endpoint CI accepts HTTP in rehearsal and rejects it in production
    When the user asks the agent to respond to the endpoint review thread
    Then the tracker keeps HTTP for rehearsal only and requests no new safeguard
    And the feedback analysis leaves the workspace and Git history unchanged
