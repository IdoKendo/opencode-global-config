---
name: build-the-tool
description: >-
  Use for edits, migrations, analyses, or checks where repeatable automation materially improves
  correctness or verification. Reuse an existing tool or build the smallest rerunnable check.
---

# Build the Tool

When repeatable automation improves the work, use a tool that does it or verifies it.

A codemod, generator, or script does the work the same way every time and reruns for free. The tool
is one artifact a reviewer can read and rerun to check the work. Hand-done changes can only be
re-verified by redoing them. A deterministic script turns "trust me" into "run this".

Prefer an existing tool or reproducible command before adding a script. Build only when it adds
useful automation or proof; judgment-heavy reviews and small edits do not require a new file merely
to satisfy this skill.

- Do the first unit by hand to learn the recipe, then build the tool. Prove it by rerunning it on
  that unit and diffing against your hand-done version. Make the lever safe to rerun.
- Codemod or script for edits, generator for repetitive files, a dump-to-sqlite query for analysis,
  a rerunnable check for verification.
- For analysis and checks, compare a known-good input and a deliberately invalid or boundary input
  against independently established expectations. Confirm failures are reported and incomplete
  evidence cannot look like success. State what still requires human judgment or runtime
  verification.
- A deterministic lever beats fan-out. If the tool can process every unit in one pass, run it
  yourself. Don't fan out delegates to hand-apply what a script can do.
- When you fan work out to subagents, write the lever as a skill they all read: the recipe, the
  verification contract, and the do-not-touch fences in one artifact. Keep it outside the delegates'
  write scope so they can't quietly edit the contract.
- Record the tool or command, inputs, and actual verification result. Add a durable file only when
  future work needs it; keep disposable investigation artifacts outside the repository.
- Stage or commit a reusable tool only when explicitly authorized.

The bar is useful, reproducible proof. A one-off can justify a tool, but not unnecessary
infrastructure. Build the smallest missing piece, never a framework.
