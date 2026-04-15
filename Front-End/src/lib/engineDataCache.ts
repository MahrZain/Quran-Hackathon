/**
 * Coalesces identical in-flight GETs (e.g. React StrictMode double-mount) so the engine
 * is hit once per streak session / verse key while prefetch + page hooks overlap.
 */
import { apiClient } from './apiClient'
import type { HistoryMessage, StreakActivityItem, StreakSnapshot, VerseBundleResponse } from './apiTypes'

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

export function fetchStreakActivitiesDeduped(sessionId: string, limit = 120) {
  return share(`streakActs:${sessionId}:${limit}`, () =>
    apiClient
      .get<StreakActivityItem[]>(`/streak/${sessionId}/activities`, { params: { limit } })
      .then((r) => r.data),
  )
}

/** Drop coalesced GET so the next fetch hits the engine (e.g. after mark-complete or tab focus). */
export function invalidateStreakActivitiesCache(sessionId: string, limit = 200) {
  inflight.delete(`streakActs:${sessionId}:${limit}`)
}

function verseCacheKey(verseKey: string, translationResourceId?: number | null) {
  const tr = translationResourceId != null && translationResourceId >= 1 ? String(translationResourceId) : 'default'
  return `verse:${verseKey}:tr:${tr}`
}

export function fetchVerseBundleDeduped(verseKey: string, translationResourceId?: number | null) {
  const params: { verse_key: string; translation_resource_id?: number } = { verse_key: verseKey }
  if (translationResourceId != null && translationResourceId >= 1) {
    params.translation_resource_id = translationResourceId
  }
  return share(verseCacheKey(verseKey, translationResourceId), () =>
    apiClient.get<VerseBundleResponse>('/verse', { params }).then((r) => r.data),
  )
}

export function fetchHistoryDeduped(sessionId: string) {
  return share(`history:${sessionId}`, () =>
    apiClient.get<HistoryMessage[]>(`/history/${sessionId}`).then((r) => r.data),
  )
}

/** Warm browser audio cache when URL is already known (no extra HTTP). */
export function preloadAudioFromUrl(url: string | null | undefined): void {
  const u = url?.trim()
  if (!u) return
  try {
    const el = new Audio(u)
    el.preload = 'auto'
    void el.load()
  } catch {
    /* ignore */
  }
}

/**
 * Fetch verse bundle (deduped) then preload audio URL.
 */
export function preloadVerseAudio(verseKey: string): void {
  void fetchVerseBundleDeduped(verseKey)
    .then((data) => {
      preloadAudioFromUrl(data.audio_url)
    })
    .catch(() => {})
}

/** Parallel streak + verse; safe to call from layout prefetch. */
export function prefetchStreakAndVerseParallel(sessionId: string, verseKey: string) {
  return Promise.all([fetchStreakSnapshotDeduped(sessionId), fetchVerseBundleDeduped(verseKey)])
}
