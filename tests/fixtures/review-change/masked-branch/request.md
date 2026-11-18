# Shipping offer

Charge 500 cents for shipping below 5000 cents; shipping is free at and above 5000 cents.

## Merge review card

Return JSON with `baseline` (review start commit SHA), `changedFiles` (branch paths),
and `defects` (confirmed issues). For an incorrect fee include `file`, `subtotalCents`,
`expectedFeeCents`, and `actualFeeCents` on the defect so support can reproduce it.
