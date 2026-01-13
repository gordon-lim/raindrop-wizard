export function traceStep<T>(step: string, callback: () => T): T {
  updateProgress(step);
  return callback();
}

export function updateProgress(_step: string) {
  // No-op: analytics removed
}
