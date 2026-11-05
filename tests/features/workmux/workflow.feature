@workmux
Feature: Plan workmux operations with correct placement and resource ownership
  These scenarios exercise agent guidance against supplied environment snapshots.
  They do not execute workmux or establish real tmux lifecycle correctness.

  Background:
    Given workmux planning is limited to the supplied environment snapshot

  Scenario: Plan workmux dispatch into the requested repository and terminal
    Given billing uses session mode and the requested destination is a window in ops
    When the user asks the agent to plan the billing dispatch
    Then workmux is selected through normal skill discovery
    And the dispatch separates repository, branch, handle, and terminal placement
    And the worker handoff preserves verification and execution limits
    And the workmux planner makes no environment changes

  Scenario: Provision headless work without starting an agent
    Given provisioning hooks are configured and the returned handle differs from the branch
    When the user asks the agent to plan headless provisioning and later attachment
    Then workmux is selected through normal skill discovery
    And headless provisioning uses compatible options and the returned identity
    And the workmux planner makes no environment changes

  Scenario: Monitor ambiguous handles without treating done as verified
    Given two projects have a retry handle and billing has a failed verification result
    When the user asks the agent to plan a follow-up and assess completion
    Then workmux is selected through normal skill discovery
    And monitoring targets billing and distinguishes waiting from verified completion
    And the workmux planner makes no environment changes

  Scenario: Match workmux lifecycle commands to the requested retained resources
    Given six owners request different terminal, worktree, and branch lifecycles
    When the user asks the agent to plan each authorized lifecycle independently
    Then workmux is selected through normal skill discovery
    And each lifecycle command preserves exactly the requested resources
    And cleanup checks Git state and preserves evidence before removal
    And the workmux planner makes no environment changes

  Scenario: Preserve dirty work when only creation was authorized
    Given a worktree has uncommitted edits and no merge or discard authorization
    When the user asks the agent to assess whether the worktree can be retired
    Then workmux is selected through normal skill discovery
    And retirement waits for authorization without proposing a destructive shortcut
    And the workmux planner makes no environment changes
