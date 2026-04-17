import { isAxiosError } from 'axios'

/**
 * Human-readable message for failed API calls.
 * `ERR_CONNECTION_REFUSED` / no response → backend not running or wrong URL/port.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(err)) {
    if (!err.response) {
      return 'Server is unreachable. Please check your internet connection and try again.'
    }
    const data = err.response.data as { detail?: unknown } | undefined
    const det = data?.detail
    if (typeof det === 'string') return det
    if (Array.isArray(det)) return 'Invalid request.'
  }
  if (err instanceof Error) return err.message
  return fallback
}
