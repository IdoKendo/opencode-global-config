@summarize-change
Feature: Hand a reviewer a local change overview
  Scenario: Follow the published GitHub branch instead of the GitLab origin
    Given a receiver change tracking a differently named GitHub branch with a GitLab origin
    When the user asks the agent to summarize the current branch
    Then the handoff links the local overview and explains the receiver change
    And the page links pull request 17 using only GitHub evidence

  Scenario: Review a renamed file and its deleted-line discussion in a nested GitLab group
    Given a receiver merge request in a nested GitLab group outside the checkout origin
    When the user asks the agent to summarize the explicit merge request
    Then the handoff links the local overview and explains the receiver change
    And the page links the renamed file and its old-side question using only GitLab evidence
    And source and summary markup are readable as literal text

  Scenario: Show the available GitHub patch without presenting it as complete
    Given a GitHub change with missing local commits and only one of two patches available
    When the user asks the agent to summarize the explicit pull request
    Then the handoff links the local overview and flags the evidence limit
    And the page retains the available hunk and warns about the incomplete diff
