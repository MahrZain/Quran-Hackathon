/** Run work after paint / when idle; `timeout` caps wait so data still arrives under load. */
export type IdleScheduleHandle = { cancel: () => void }

export function scheduleIdleTask(
  fn: () => void,
  options?: { timeoutMs?: number; delayMs?: number },
): IdleScheduleHandle {
  const timeoutMs = options?.timeoutMs ?? 1400
  const delayMs = options?.delayMs ?? 0

  let innerCancel: (() => void) | null = null
  const outer = window.setTimeout(() => {
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(fn, { timeout: timeoutMs })
      innerCancel = () => cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(fn, 32)
      innerCancel = () => clearTimeout(id)
    }
  }, delayMs)

  return {
    cancel: () => {
      clearTimeout(outer)
      innerCancel?.()
    },
  }
}
