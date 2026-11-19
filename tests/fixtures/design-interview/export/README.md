# Monthly ledger export

Finance exports the ledger as a CSV file to Downloads. The format and destination
are contractual. Each export in the same month currently writes the same filename.

The desktop team's two proposed collision policies are **Replace** (write over
the previous export) and **Keep both** (save another copy).

The interview tracker renders chat replies as forms. Return only JSON (a JSON
fence is fine). While interviewing, send `{"questions":[{"field":...,"choices":[...]}]}`:
each entry renders “Which *field*: *choice* or *choice*?” Use field IDs
`format`, `destination`, `collisionPolicy`, or `suffix`, and the team's exact
option labels where supplied. At close, return `confirmed` (an array of
`{"field":...,"value":...}` decisions) and `open` (an array of undecided field
IDs). Record decisions made in the interview, not pre-existing contract terms.
