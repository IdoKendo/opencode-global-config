# OpenCode history retrieval

Use the built-in OpenCode skill, V2 documentation, and the live `/openapi.json` contract through
supported API access. Reuse configured authentication; do not bypass denied access through storage.

## Collection

Confirm these previously observed routes and parameters against the live contract:

- `/api/session`: list roots with `parentID=null`; follow `cursor.next` to exhaustion.
- Query archived roots separately if excluded by default.
- `/api/session/{id}/message`: collect user messages first, then relevant assistant turns.
- Message limit: 200. Cursor requests retain the type filter and omit `order`.

Roots are a screening boundary. Inspect relevant children and fork relationships for authentic
turns; delegated prompts are not preferences. Include recent messages from older sessions.

## Coverage checks

Record page and unique session/message counts, archives, errors, and final cursor state. An export
manifest describes collection, not review. Large output can truncate despite a successful exit:
capture complete JSON in disposable storage outside repositories when needed, then validate it.

Retry failures through supported access when appropriate; disclose remaining gaps. Unavailable does
not mean empty. If collection cannot finish within practical limits, request a narrower scope rather
than silently sampling. Report retention limits and actual review depth as specified in the skill.
