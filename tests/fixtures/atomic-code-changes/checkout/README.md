# Checkout

All amounts are integer cents. `total(items)` sums price times quantity and returns zero for an
empty cart. `shipping(subtotal)` charges 500 cents below 5000 cents and is free from 5000 cents.

Run `node verify.mjs total` or `node verify.mjs shipping` for focused checks. Run
`node verify.mjs` for both. These checks use only Node built-ins and require no services.
