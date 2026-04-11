import { useCallback } from 'react'

export type RecitationRef = {
  surahId: number
  ayahNumber: number
}

/**
 * Placeholder for Quran Foundation Audio API integration.
 * Wire `playRecitation` to streaming / fetch when the API is available.
 */
export function useSound() {
  const playRecitation = useCallback((ref: RecitationRef) => {
    if (import.meta.env.DEV) {
      console.debug('[useSound] Recitation placeholder — Quran Foundation Audio API', ref)
    }
  }, [])

  return { playRecitation }
}
