/* Context + hook: Fast Refresh allows dual export here for app state. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { HistoryMessage } from '../lib/apiTypes'
import { fetchStreakSnapshotDeduped, fetchVerseBundleDeduped } from '../lib/engineDataCache'
import { type DailyAyah, getColdStartDailyAyah } from '../lib/mockData'
import { scheduleIdleTask } from '../lib/scheduleIdle'

/** Ayah text/audio enrichment from GET /verse (idle-scheduled so the shell paints first). */
export type VerseEnrichmentStatus = 'pending' | 'ready' | 'unavailable'

type MoodAyahContextValue = {
  displayAyah: DailyAyah
  setDisplayAyah: (ayah: DailyAyah) => void
  /** Streak from API (mark complete or dashboard hydrate — not from chat). */
  streakCount: number
  syncStreakCount: (n: number) => void
  /** Session chat rows from GET /history (refreshed after each successful /chat). */
  sessionUserMessages: number
  sessionTotalMessages: number
  refreshSessionChatStats: () => Promise<void>
  /** Engine GET /verse for the focus ayah: pending until idle prefetch finishes. */
  verseEnrichmentStatus: VerseEnrichmentStatus
}

const MoodAyahContext = createContext<MoodAyahContextValue | null>(null)

export function MoodAyahProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAppSession()
  const [displayAyah, setDisplayAyah] = useState<DailyAyah>(() => getColdStartDailyAyah())
  const [streakCount, setStreakCount] = useState(0)
  const [sessionUserMessages, setSessionUserMessages] = useState(0)
  const [sessionTotalMessages, setSessionTotalMessages] = useState(0)
  const [verseEnrichmentStatus, setVerseEnrichmentStatus] = useState<VerseEnrichmentStatus>('pending')

  const syncStreakCount = useCallback((n: number) => {
    setStreakCount(typeof n === 'number' && !Number.isNaN(n) ? n : 0)
  }, [])

  const refreshSessionChatStats = useCallback(async () => {
    try {
      const { data } = await apiClient.get<HistoryMessage[]>(`/history/${sessionId}`)
      setSessionTotalMessages(data.length)
      setSessionUserMessages(data.filter((m) => m.role === 'user').length)
    } catch {
      setSessionTotalMessages(0)
      setSessionUserMessages(0)
    }
  }, [sessionId])

  useEffect(() => {
    void refreshSessionChatStats()
  }, [refreshSessionChatStats])

  /** Streak snapshot: starts immediately (deduped); UI update is non-urgent. */
  useEffect(() => {
    let cancelled = false
    void fetchStreakSnapshotDeduped(sessionId)
      .then((snap) => {
        if (cancelled) return
        startTransition(() => syncStreakCount(snap.updated_streak_count))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [sessionId, displayAyah.surahId, displayAyah.ayahNumber, syncStreakCount])

  /** Verse bundle: idle after paint so Daily ASAR + layout stay responsive; merges when ready. */
  useEffect(() => {
    let cancelled = false
    const verseKey = `${displayAyah.surahId}:${displayAyah.ayahNumber}`
    startTransition(() => setVerseEnrichmentStatus('pending'))
    const h = scheduleIdleTask(
      () => {
        void fetchVerseBundleDeduped(verseKey)
          .then((bundle) => {
            if (cancelled) return
            const ar = bundle.verse_text_uthmani?.trim()
            const tr = bundle.verse_translation?.trim()
            const au = bundle.audio_url?.trim()
            startTransition(() => {
              if (ar || tr || au) {
                setDisplayAyah((prev) => ({
                  ...prev,
                  arabic: ar || prev.arabic,
                  translation: tr || prev.translation,
                  audioUrl: au || prev.audioUrl,
                }))
              }
              setVerseEnrichmentStatus('ready')
            })
          })
          .catch(() => {
            if (!cancelled) startTransition(() => setVerseEnrichmentStatus('unavailable'))
          })
      },
      { timeoutMs: 1600, delayMs: 0 },
    )
    return () => {
      cancelled = true
      h.cancel()
    }
  }, [sessionId, displayAyah.surahId, displayAyah.ayahNumber])

  const value = useMemo(
    () => ({
      displayAyah,
      setDisplayAyah,
      streakCount,
      syncStreakCount,
      sessionUserMessages,
      sessionTotalMessages,
      refreshSessionChatStats,
      verseEnrichmentStatus,
    }),
    [
      displayAyah,
      refreshSessionChatStats,
      sessionTotalMessages,
      sessionUserMessages,
      streakCount,
      syncStreakCount,
      verseEnrichmentStatus,
    ],
  )

  return <MoodAyahContext.Provider value={value}>{children}</MoodAyahContext.Provider>
}

export function useMoodAyah() {
  const ctx = useContext(MoodAyahContext)
  if (!ctx) {
    throw new Error('useMoodAyah must be used within MoodAyahProvider')
  }
  return ctx
}
