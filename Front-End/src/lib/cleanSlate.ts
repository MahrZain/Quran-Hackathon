import { SESSION_STORAGE_KEY } from './apiClient'

/** Keys that must not survive account switch / OAuth / logout. */
const SESSION_SCOPE_KEYS = [SESSION_STORAGE_KEY, 'asar_last_read'] as const

/**
 * Remove browser session scope (chat/streak session id, last-read hint).
 * Call before setting a new access token so the next shell mount does not reuse another account's session.
 */
export function wipeAsarSessionScopeFromBrowser(): void {
  try {
    for (const k of SESSION_SCOPE_KEYS) {
      localStorage.removeItem(k)
    }
  } catch {
    /* private mode / blocked storage */
  }
}
