---
name: test-audit
description: >-
  Invoke whenever writing, changing, reviewing, or sweeping tests. Authoring gate for new tests
  plus audit workflow for low-value, implementation-coupled, or duplicative tests and the
  test-only production seams they demand.
---

# Test Audit

Apply the authoring gate to new or changed tests. Use audits to remove low-value tests and
test-only production seams. Before auditing a whole subsystem, read [CAMPAIGN.md](CAMPAIGN.md).
Optimize for confidence, not deletion count.

## Authoring gate

Organize tests and support files by stable behavior or component ownership, not temporary change
names. Extend the owning suite and consolidate repeated setup or table cases.

Before adding a test, identify:

1. The observable behavior, invariant, or independent contract it protects.
2. A credible regression that makes it fail.
3. The gap in existing coverage. Give each contract one primary owner at the strongest boundary.
   Another layer needs a distinct risk the owner cannot exercise, such as transport or lifecycle.
4. Any production export, flag, wrapper, or injection hook needed only by tests.
   Test the real boundary instead of adding such a seam.

Do not add the test without these answers. Reject [junk patterns](#junk-patterns) unless they meet
the [retention bar](#retention-bar). Rewrite tests that fail after behavior-preserving refactors.
For bug fixes, demonstrate the intended failure before the fix and success after the owner-boundary
repair. Keep one regression at that boundary; do not repeat it through every layer.

## Junk patterns

- Assertion-free probes, self-comparisons, identity copies, and duplicate contract invocations.
- Copied fixtures, inventories, manifests, export lists, or exact source/import/string checks.
- Private predicate or call-shape checks already covered at real boundaries; provider-local
  repetitions of shared helper tests.
- Tests that preserve test-only exports, globals, wrappers, or otherwise unused production code.
- Expected values produced by the tested helper or renderer; mocks that implement the asserted
  behavior or use one identical mock for different APIs.
- Fixtures that supply owner-produced receipts, admission, or callback ordering; persistence
  assertions against a store the execution path never writes.
- Capability checks that repeat flags instead of exercising promised delivery or acknowledgement.
- Negative controls that pass through the wrong guard or an unreachable rejection.
- Names or fixtures that promise behavior the inputs and assertions do not exercise.

## Value bar

Tests must protect behavior, a credible regression, or an independent contract.
For existing tests, failure after source reorganization is evidence to investigate, not permission
to delete. Before judging a candidate, read its complete test and production owner, entry point,
callers, callees, sibling implementations, overlapping tests, CI routing, and relevant history.
Inspect dependency source or types for dependency-backed claims.

## Discovery

Keep discovery read-only and report evidence before editing. For broad audits, use independent
discovery lanes when available. Outside campaigns, select a few high-confidence candidates.

## Retention bar

Keep independent public API, plugin SDK, protocol, config, migration, storage, security, platform,
default, prompt-byte, generated cross-language, package, release, and architecture contracts.
Keep observable call ordering and credible regressions.

Source inspection can be the cheapest independent guard: it must detect contract changes to
user-facing keys, bytes, or paths and survive identifier-only refactors.
Static or slow tests are not automatically disposable. Prove that apparent implementation checks
lack independent value before removing them. Reproduce retained baseline failures as possible
product bugs and repair the owner instead of deleting coverage.

## Candidate evidence

Before editing, record each candidate's exact name and location, detectable failure, non-test
callers, and stronger remaining owner-boundary proof (or why none is needed).
Include history, purpose, unlocked production/support deletions, risk, and validation command.
A missing field blocks deletion.

## Edit shape

Choose one coherent owner-boundary batch. Remove obsolete test-only seams and dead production paths
without compatibility aliases. Move retained regressions to their canonical owners.
Consolidate repeated package or dependency assertions into one generic contract.
Prefer fewer production lines. Do not replace deleted tests with equivalent implementation checks
or treat uncertain candidates as cleanup.

## Validation

Do not edit source or tests during an active run in the same checkout.
Use the repository's runner, supported environment, and path or name filters.

1. Run the smallest owner and sibling suites.
2. For removed source or plan assertions, run the script or dry-run that owns the contract.
3. Run targeted formatting, `git diff --check`, and checks required by repository policy and CI.
4. Review the final diff for lost coverage and behavior changes, using repository review tools when
   available. Inspect `git diff --numstat`; count production/tooling separately from tests/support.

## Landing and continuation

Continue broad audits as coherent follow-up changes. After each authorized merge, refresh from the
target branch and repeat read-only discovery.

## Handoff

Report root causes, removed categories, production simplifications, and retained false positives
with reasons. Include checks actually run, production versus test LOC, change/merge state, and
named follow-ups.
