@review_change
Feature: Review the commits that would ship
  Scenario: Review the proposed shipping fee even when the checkout already fixes it
    Given release advanced after shipping-offer branched and a local edit fixes the offer
    When the user asks the agent to review shipping-offer for merge
    Then the review attributes only the shipping change to the branch since divergence
    And the review reports that a qualifying order of 5000 cents still costs 500 cents to ship
    And the review preserves every file and the Git state
