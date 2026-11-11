# Change and measurements

The GitHub Actions agent-evaluation command now passes --parallel 39 to Cucumber.
Assertions, model, timeout, JSON report, and artifact upload are unchanged.
Local full-suite execution went from 1557 seconds to 87 seconds (about 18 times faster),
with all 39 scenarios passing. GitHub Actions has not run this change yet.

Repository convention: Conventional Commits, with ci: for workflow changes.
