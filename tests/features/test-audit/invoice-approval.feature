@test_audit
Feature: Catch repeat invoice approvals
  Scenario: Catch a second approval even when the approver has permission
    Given an invoice suite that checks repeat approval using a read-only caller
    When the user asks the agent to close the invoice approval coverage gap
    Then the suite passes when an invoice can be approved only once
    And the suite fails when an approver can approve the same invoice twice
    And the suite still passes when approval checks run in the opposite order
