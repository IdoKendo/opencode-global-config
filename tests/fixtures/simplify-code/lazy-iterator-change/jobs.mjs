export function* readyJobs(source) {
  for (const job of source) {
    if (job != null) {
      if (!job.paused) {
        if (job.ready) {
          yield job;
        }
      }
    }
  }
}
