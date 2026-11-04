# Document checks

## Run the suite

Run the tests before you change them.

## Maintain the suite

The suite has 2 scenarios:

- Preserve the project start command
- Preserve the local service address

The document must contain node server.mjs and http://localhost:4100.
The runner calls copyFile, reads the copied text, and calls assert.ok for each expected string.
