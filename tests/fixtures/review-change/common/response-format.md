Return only JSON (an optional JSON code fence is fine):

{
  "Scope": "Baseline, included changes, and requirement source",
  "Requirements": {
    "status": "pass | findings | unavailable",
    "explanation": "Evidence and limitations",
    "findings": [
      { "file": "relative path", "line": 1, "source": "requirement source", "detail": "behavior and impact" }
    ]
  },
  "Code quality": {
    "status": "pass | findings | unavailable",
    "explanation": "Evidence and limitations",
    "findings": [
      { "file": "relative path", "line": 1, "source": "standard or other evidence", "detail": "problem and impact" }
    ]
  },
  "Verification and gaps": "Checks, limitations, and questions for the user"
}

Use one of the listed status values. Include only justified findings.
Use the source's repository-relative path, optionally followed by a line or
line range. For incorrect fees, include `subtotalCents`, `expectedFeeCents`,
and `actualFeeCents` on the finding. For event-routing violations, include
`expectedCall` and `actualCall` (receiver.method identifiers from the baseline
and change). When requirements are unavailable, include `limitation` on the
Requirements result with `source` (relative path) and `quote` (verbatim
sentence from the review context explaining the limitation).
