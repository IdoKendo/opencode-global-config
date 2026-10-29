# Request retries

The worker retries failed requests up to 3 times, but only when the request includes an idempotency key; requests without that key fail immediately and must be reviewed by the operator.

- Check the request before retrying.
  - Keep the original idempotency key for every retry so that repeated requests cannot create duplicate records when the first response is lost in transit.
  - Record the final outcome.
- Escalate requests that exhaust their retry allowance.
