export function scheduleRetry(task, delay) {
  // delay is in milliseconds.
  return setTimeout(task, delay);
}
