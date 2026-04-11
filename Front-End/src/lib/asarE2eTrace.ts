/**
 * Temporary UAT tracing — remove or gate behind import.meta.env.DEV when no longer needed.
 */
export function asarE2eTrace(phase: string, data?: unknown): void {
  console.group('ASAR E2E Trace')
  console.log(phase, data === undefined ? '' : data)
  console.groupEnd()
}
