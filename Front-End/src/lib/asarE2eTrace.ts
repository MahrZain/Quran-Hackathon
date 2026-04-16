/**
 * Temporary UAT tracing — dev-only so production builds keep a clean console (event stream).
 */
export function asarE2eTrace(phase: string, data?: unknown): void {
  if (import.meta.env.PROD) return
  console.group('ASAR E2E Trace')
  console.log(phase, data === undefined ? '' : data)
  console.groupEnd()
}
