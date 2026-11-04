export function process(items, send, audit) {
  const results = [];
  for (const item of items) {
    if (item !== null) {
      if (item.enabled) {
        audit('sending', item);
        const result = send(item);
        audit('sent', item);
        results.push(result);
      } else {
        audit('skipped', item);
      }
    } else {
      audit('missing', item);
    }
  }
  return results;
}
