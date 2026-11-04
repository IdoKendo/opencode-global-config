# Fixture project

This is a local Node.js project with no package dependencies.
Run its suite with `node run-tests.mjs`.
The public API is `deliveryCharge(total)` in `shipping.mjs`; totals are in dollars.
Orders of $50 or more have free delivery. Smaller orders pay $5.
`checkout.mjs` is the production caller. `run-tests.mjs` is test infrastructure; do not edit it.
Keep work local, unstaged and uncommitted. Do not use external services or delegate work.
