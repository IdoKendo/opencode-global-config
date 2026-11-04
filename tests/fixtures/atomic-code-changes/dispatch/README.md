# Dispatch transport migration

The dispatcher currently takes a `send(item)` callback. The replacement transport is an object
with a `send(item)` method. That method uses its object as `this`.

Change `dispatch(items, transport, telemetry)` to use the object transport. Keep the ordered
result array and the existing operational behavior. The transport change needs no dependencies.
The separate invoice formatter is not part of this change.

## Verification

Run `node verify.mjs` on the final object transport implementation.
Use `node verify.mjs --legacy` to check the original callback implementation before migration.
The checks cover an empty batch, ordered results, logs, metrics, and transport failure.
