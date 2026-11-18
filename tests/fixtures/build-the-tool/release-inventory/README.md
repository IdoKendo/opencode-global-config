# Release desk

Run `node desk.mjs DIRECTORY` for a desk export (the current one is `inbox`).
The desk client consumes a JSON object on stdout, keyed by release ID. Values
are `"ready"` and `"blocked"`. Reporting blocked releases is a normal successful
run. Desk exports are read-only.

## Sign-off policy

The release manifest is the packing list. A release needs at least one target,
and every target needs a passing approval for that release, unit and revision.
Approvals are final and unique per (release, unit, revision) in a desk export.
Historical approvals and approvals for units outside the packing list have
no bearing on sign-off.
