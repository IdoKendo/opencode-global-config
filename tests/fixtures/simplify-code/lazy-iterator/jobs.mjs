export function* readyJobs(source) {
  for (const job of source) {
    if (job && job.ready) yield job;
  }
}
