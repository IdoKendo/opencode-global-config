export function dispatch(items, send, telemetry) {
  const results = [];
  for (const item of items) {
    telemetry.log('sending', item.id);
    telemetry.increment('delivery.attempts');
    const result = send(item);
    telemetry.log('sent', item.id);
    telemetry.increment('delivery.sent');
    results.push(result);
  }
  return results;
}
