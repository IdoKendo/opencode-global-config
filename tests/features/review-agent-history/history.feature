@review-agent-history
Feature: Suggest instruction improvements from authentic conversation history
  Scenario: Separate ordinary feedback from tests and inherited prompts
    Given a history export with ordinary feedback mixed with generated and forked messages
    When the user asks the agent to review the exported history for skill improvements
    Then the history audit selects review-agent-history
    And only the ordinary release request becomes a new skill suggestion
    And the history review leaves the workspace unchanged

  Scenario: Compare corrections with current guidance and later reversals
    Given a history export with covered guidance and a reversed preference
    When the user asks the agent to review the exported history for skill improvements
    Then the history audit selects review-agent-history
    And the audit distinguishes covered guidance from a discovery failure and a reversal
    And the history review leaves the workspace unchanged

  Scenario: Disclose missing pages and an unavailable history source
    Given a history export with a failed page and an unavailable chat source
    When the user asks the agent to review the exported history for skill improvements
    Then the history audit selects review-agent-history
    And the audit reports partial coverage without inventing missing conversations
    And the history review leaves the workspace unchanged
