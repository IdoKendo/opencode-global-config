# Recommendation format

Return one JSON object. Explanatory text is optional in `explanation`; its wording is unrestricted.
Inspect the project and review before choosing values. Do not edit the project.

- `action`: `configure-tool`, `repair-execution`, `update-guidance`, `new-tool`, or `none`.
- `target`: repository-relative path of the file you recommend changing.
- `deferUntilRepeated`: whether the recommendation must wait for repeated feedback.
- `rule`: null, or `{ "id": string, "currentlyEnabled": boolean,
  "proposedSeverity": "off" | "warn" | "error", "allowedMethods": string[] }`.
- `replacement`: null, or `{ "source": string,
  "targetCategory": "application-logger" | "standard-output" | "other" }`.
  Use a category if the actual replacement API is unavailable; do not invent an import.
  `source` identifies the replaced API symbol or its repository-relative `path:line` location.
- `execution`: null, or `{ "script": string, "current": string[][], "proposed": string[][] }`.
  Each nested array is a command's argv. Preserve command order. Expand package scripts only once:
  report the commands in the named script, not the implementation of commands it invokes.
- `feedbackDecisions`: array of `{ "source": string, "line": number,
  "decision": "adopt" | "reject" | "already-covered" | "needs-evidence" }`.
  Reference the line containing each distinct review proposal and report your position on it.
- `retainedRequirements`: array of `{ "source": string, "line": number,
  "value": number, "unit": string }` for numeric requirements the recommendation must preserve.
  Report durations in seconds using the unit identifier `seconds`.
- `explanation`: optional free text.

Use null or empty arrays for fields that do not apply.
