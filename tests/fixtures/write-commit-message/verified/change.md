# Change and measurements

The GitHub Actions agent-evaluation command now runs Cucumber scenarios in parallel.
The same 39 scenarios, model, timeout, runner class, and assertions were used before
and after. Verified GitHub Actions evaluation-step timings: 24 minutes before,
2 minutes after. All 39 scenarios passed in both runs. These timings exclude
installation and upload steps; the total workflow duration was not measured.

Repository convention: Conventional Commits, with ci: for workflow changes.
