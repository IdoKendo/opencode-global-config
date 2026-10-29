# Request processing

The worker retries failed requests up to 3 times, but only when the request includes an idempotency key; requests without that key fail immediately and must be reviewed by the operator.

| Component | Responsibility |
| --- | --- |
| Retry worker | Preserve the original idempotency key across all retry attempts and record the final outcome before acknowledging the request. |

```text
+----------------------+                          +----------------------+                          +----------------------+
| Incoming request     | -----------------------> | Retry worker         | -----------------------> | Outcome store        |
+----------------------+                          +----------------------+                          +----------------------+
```

```python
message = "Preserve these spaces:    request accepted    retry scheduled    final outcome recorded    acknowledgement sent"
print(message)
```

[Retry reference](https://example.com/documentation/workers/retries/idempotency-and-request-processing/reference?section=preserving-original-request-keys)
