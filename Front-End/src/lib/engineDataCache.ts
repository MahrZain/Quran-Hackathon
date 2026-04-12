/**
 * Coalesces identical in-flight GETs (e.g. React StrictMode double-mount) so the engine
 * is hit once per streak session / verse key while prefetch + page hooks overlap.
 */
import { apiClient } from './apiClient'
import type { StreakSnapshot, VerseBundleResponse } from './apiTypes'

const inflight = new Map<string, Promise<unknown>>()

function share<T>(key: string, run: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key)
  if (existing) return existing as Promise<T>
  const p = run().finally(() => {
    queueMicrotask(() => inflight.delete(key))
  })
  inflight.set(key, p)
  return p
}

export function fetchStreakSnapshotDeduped(sessionId: string) {
  return share(`streak:${sessionId}`, () =>
    apiClient.get<StreakSnapshot>(`/streak/${sessionId}`).then((r) => r.data),
  )
}

export function fetchVerseBundleDeduped(verseKey: string) {
  return share(`verse:${verseKey}`, () =>
    apiClient.get<VerseBundleResponse>('/verse', { params: { verse_key: verseKey } }).then((r) => r.data),
  )
}

/** Parallel streak + verse; safe to call from layout prefetch. */
export function prefetchStreakAndVerseParallel(sessionId: string, verseKey: string) {
  return Promise.all([fetchStreakSnapshotDeduped(sessionId), fetchVerseBundleDeduped(verseKey)])
}
