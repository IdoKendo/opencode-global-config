# Pricing lookup change

The change replaces repeated linear lookups with one request-local index.
The existing result tests passed locally. The index does not persist between requests.

## Local benchmark

- Median elapsed time before: 240 ms.
- Median elapsed time after: 180 ms.
- 10 measured samples per version, after one warm-up run.
- 100,000 input records per sample, fixed seed 17, one worker.
- Node.js 24 on macOS arm64, on the same laptop for both versions.

## Verification limits

CI has not run: `CI_RUN_TOKEN` is unavailable in this workspace.
Production has not been checked: `PROD_READ_TOKEN` is unavailable in this workspace.
There is no production before-and-after measurement or end-to-end result.
