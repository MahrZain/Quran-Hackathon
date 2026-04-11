import { isAxiosError } from 'axios'

/**
 * Human-readable message for failed API calls.
 * `ERR_CONNECTION_REFUSED` / no response → backend not running or wrong URL/port.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (isAxiosError(err)) {
    if (!err.response) {
      return 'Cannot reach the API. Start the backend in a terminal: cd Back-End && ./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000. If you use another port, set VITE_API_BASE_URL in Front-End/.env (e.g. http://localhost:8001/api/v1).'
    }
    const data = err.response.data as { detail?: unknown } | undefined
    const det = data?.detail
    if (typeof det === 'string') return det
    if (Array.isArray(det)) return 'Invalid request.'
  }
  if (err instanceof Error) return err.message
  return fallback
}
