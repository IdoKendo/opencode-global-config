# Change

The GitHub Actions agent-evaluation step now passes --parallel 39 to Cucumber.
Previously it ran scenarios sequentially. Assertions, model, timeout, JSON report,
and artifact upload are unchanged. The intended benefit is faster agent evaluation.
No CI timing measurements are available.

Repository convention: Conventional Commits, with ci: for workflow changes.
