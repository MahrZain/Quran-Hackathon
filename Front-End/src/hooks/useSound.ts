import { useCallback } from 'react'

import { apiClient } from '../lib/apiClient'
import { asarE2eTrace } from '../lib/asarE2eTrace'
import type { VerseBundleResponse } from '../lib/apiTypes'

export type RecitationRef = {
  surahId: number
  ayahNumber: number
  /** When set (e.g. from chat), skips GET /verse for audio. */
  audioUrl?: string | null
}

export type PlayRecitationResult = 'ok' | 'no_url' | 'blocked'

/**
 * Plays verse audio: uses `audioUrl` when present, otherwise GET /api/v1/verse?verse_key=…
 */
export function useSound() {
  const playRecitation = useCallback(async (ref: RecitationRef): Promise<PlayRecitationResult> => {
    const verseKey = `${ref.surahId}:${ref.ayahNumber}`
    let url = ref.audioUrl?.trim() || null
    try {
      if (!url) {
        const { data } = await apiClient.get<VerseBundleResponse>('/verse', {
          params: { verse_key: verseKey },
        })
        url = data.audio_url?.trim() || null
        if (import.meta.env.DEV && !url) {
          console.debug('[useSound] No audio URL from API for', verseKey)
        }
      }
      if (!url) return 'no_url'

      asarE2eTrace('Play recitation', { verseKey, hasUrl: true })
      const el = new Audio(url)
      await el.play()
      return 'ok'
    } catch {
      asarE2eTrace('Play recitation failed', { verseKey })
      // Distinguish: had URL but play() rejected (e.g. autoplay) vs fetch failed
      const hadUrl = Boolean(url)
      return hadUrl ? 'blocked' : 'no_url'
    }
  }, [])

  return { playRecitation }
}
