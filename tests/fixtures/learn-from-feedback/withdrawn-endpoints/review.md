# Endpoint review

Riley: Please ban HTTP for every endpoint. Can you add a check for that?

Sam: The rehearsal listener only speaks HTTP. We need TLS for production.

Riley (final reply): Agreed. I withdraw the blanket ban. Keep rehearsal working.
What matters to me is that a production HTTP endpoint cannot pass CI.

The review tracker takes a JSON reply with three fields:

- `httpAllowedIn`: list of environment names where an HTTP endpoint can pass.
- `blockingScript`: package script actually invoked by CI for the endpoint check, or null if absent.
- `followUps`: list of recommended safeguard changes. Use an empty list when there is no work.
