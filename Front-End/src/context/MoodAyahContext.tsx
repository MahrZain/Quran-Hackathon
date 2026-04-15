/* Context + hook: Fast Refresh allows dual export here for app state. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { useAppSession } from '../hooks/useAppSession'
import type { HistoryMessage } from '../lib/apiTypes'
import {
  fetchHistoryDeduped,
  fetchStreakSnapshotDeduped,
  fetchVerseBundleDeduped,
  preloadAudioFromUrl,
} from '../lib/engineDataCache'
import {
  dailyAyahFromVerseKey,
  type DailyAyah,
  fillSurahMeta,
  getColdStartDailyAyah,
  isAyahArabicPlaceholder,
} from '../lib/mockData'
import { scheduleIdleTask } from '../lib/scheduleIdle'

/** Ayah text/audio enrichment from GET /verse (idle-scheduled so the shell paints first). */
export type VerseEnrichmentStatus = 'pending' | 'text_ready' | 'ready' | 'unavailable'

const TRANSLATION_LOADING_PLACEHOLDER = 'Loading translation…'

type MoodAyahContextValue = {
  displayAyah: DailyAyah
  setDisplayAyah: (ayah: DailyAyah) => void
  /** Streak from API (mark complete or dashboard hydrate — not from chat). */
  streakCount: number
  syncStreakCount: (n: number) => void
  /** Session chat rows from GET /history (refreshed after each successful /chat). */
  sessionUserMessages: number
  sessionTotalMessages: number
  /** User-authored lines from GET /history (deduped); stale on error until retry succeeds. */
  sessionUserTexts: string[]
  /** True while a non-silent history refresh is in flight (initial or explicit refresh). */
  sessionHistoryLoading: boolean
  /** Last non-silent fetch failed; data may be stale. */
  sessionHistoryError: boolean
  refreshSessionChatStats: () => Promise<void>
  /** Engine GET /verse for the focus ayah: pending until idle prefetch finishes. */
  verseEnrichmentStatus: VerseEnrichmentStatus
  /** Mark-complete taps today (UTC, from server) — drives part of the dashboard ring. */
  ayahsMarkedToday: number
  syncAyahsMarkedToday: (n: number) => void
}

const MoodAyahContext = createContext<MoodAyahContextValue | null>(null)

export function MoodAyahProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAppSession()
  const { user } = useAuth()
  const [displayAyah, setDisplayAyah] = useState<DailyAyah>(() => getColdStartDailyAyah())
  const [streakCount, setStreakCount] = useState(0)
  const [sessionUserMessages, setSessionUserMessages] = useState(0)
  const [sessionTotalMessages, setSessionTotalMessages] = useState(0)
  const [sessionUserTexts, setSessionUserTexts] = useState<string[]>([])
  const [sessionHistoryLoading, setSessionHistoryLoading] = useState(false)
  const [sessionHistoryError, setSessionHistoryError] = useState(false)
  const [verseEnrichmentStatus, setVerseEnrichmentStatus] = useState<VerseEnrichmentStatus>('pending')
  const [ayahsMarkedToday, setAyahsMarkedToday] = useState(0)

  const historyRetryGenRef = useRef(0)
  const historyRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const historyLoadSeqRef = useRef(0)

  const applyHistoryMessages = useCallback((data: HistoryMessage[]) => {
    const texts = data.filter((m) => m.role === 'user').map((m) => m.content.trim()).filter(Boolean)
    setSessionTotalMessages(data.length)
    setSessionUserMessages(texts.length)
    setSessionUserTexts(texts)
    setSessionHistoryError(false)
  }, [])

  const syncStreakCount = useCallback((n: number) => {
    setStreakCount(typeof n === 'number' && !Number.isNaN(n) ? n : 0)
  }, [])

  const syncAyahsMarkedToday = useCallback((n: number) => {
    setAyahsMarkedToday(typeof n === 'number' && !Number.isNaN(n) && n >= 0 ? n : 0)
  }, [])

  const cancelHistoryRetries = useCallback(() => {
    historyRetryGenRef.current += 1
    if (historyRetryTimeoutRef.current !== null) {
      clearTimeout(historyRetryTimeoutRef.current)
      historyRetryTimeoutRef.current = null
    }
  }, [])

  const scheduleHistoryRetries = useCallback(
    (genAtSchedule: number) => {
      let attempt = 0
      const run = () => {
        if (genAtSchedule !== historyRetryGenRef.current) return
        attempt += 1
        if (attempt > 3) return
        const delayMs = Math.min(2000 * 2 ** (attempt - 1), 16000)
        historyRetryTimeoutRef.current = setTimeout(() => {
          historyRetryTimeoutRef.current = null
          if (genAtSchedule !== historyRetryGenRef.current) return
          void fetchHistoryDeduped(sessionId)
            .then((data) => {
              if (genAtSchedule !== historyRetryGenRef.current) return
              startTransition(() => applyHistoryMessages(data))
            })
            .catch(() => {
              if (genAtSchedule !== historyRetryGenRef.current) return
              run()
            })
        }, delayMs)
      }
      run()
    },
    [applyHistoryMessages, sessionId],
  )

  const refreshSessionChatStats = useCallback(async () => {
    cancelHistoryRetries()
    const gen = historyRetryGenRef.current
    const loadSeq = ++historyLoadSeqRef.current
    startTransition(() => setSessionHistoryLoading(true))
    try {
      const data = await fetchHistoryDeduped(sessionId)
      if (gen !== historyRetryGenRef.current) return
      startTransition(() => applyHistoryMessages(data))
    } catch {
      if (gen !== historyRetryGenRef.current) return
      startTransition(() => setSessionHistoryError(true))
      scheduleHistoryRetries(gen)
    } finally {
      startTransition(() => {
        if (loadSeq === historyLoadSeqRef.current) setSessionHistoryLoading(false)
      })
    }
  }, [applyHistoryMessages, cancelHistoryRetries, scheduleHistoryRetries, sessionId])

  /** Idle-first history load; bounded background retries on failure (silent). */
  useEffect(() => {
    cancelHistoryRetries()
    const gen = historyRetryGenRef.current
    let cancelled = false
    const h = scheduleIdleTask(
      () => {
        if (cancelled) return
        const loadSeq = ++historyLoadSeqRef.current
        startTransition(() => setSessionHistoryLoading(true))
        void fetchHistoryDeduped(sessionId)
          .then((data) => {
            if (cancelled || gen !== historyRetryGenRef.current) return
            startTransition(() => applyHistoryMessages(data))
          })
          .catch(() => {
            if (cancelled || gen !== historyRetryGenRef.current) return
            startTransition(() => setSessionHistoryError(true))
            scheduleHistoryRetries(gen)
          })
          .finally(() => {
            startTransition(() => {
              if (loadSeq === historyLoadSeqRef.current) setSessionHistoryLoading(false)
            })
          })
      },
      { timeoutMs: 400, delayMs: 0 },
    )
    return () => {
      cancelled = true
      h.cancel()
      cancelHistoryRetries()
    }
  }, [sessionId, applyHistoryMessages, cancelHistoryRetries, scheduleHistoryRetries])

  /** Server reading cursor or legacy recommended key (GET /auth/me). */
  useEffect(() => {
    const key = user?.current_verse_key || user?.recommended_verse_key
    if (!key || !/^\d+:\d+$/.test(key)) return
    const parts = key.split(':')
    const si = Number(parts[0])
    const an = Number(parts[1])
    if (!Number.isFinite(si) || !Number.isFinite(an)) return
    startTransition(() => {
      setDisplayAyah((prev) => {
        if (prev.surahId === si && prev.ayahNumber === an && !isAyahArabicPlaceholder(prev.arabic)) {
          return fillSurahMeta(prev)
        }
        return fillSurahMeta(dailyAyahFromVerseKey(key))
      })
    })
  }, [user?.current_verse_key, user?.recommended_verse_key, user?.id])

  useEffect(() => {
    const n = user?.ayahs_marked_today
    if (typeof n === 'number' && !Number.isNaN(n)) {
      startTransition(() => syncAyahsMarkedToday(n))
    }
  }, [user?.ayahs_marked_today, user?.id, syncAyahsMarkedToday])

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
              if (!ar && !tr && !au) {
                setDisplayAyah((prev) => fillSurahMeta(prev))
                setVerseEnrichmentStatus('unavailable')
                return
              }

              if (ar) {
                setDisplayAyah((prev) =>
                  fillSurahMeta({
                    ...prev,
                    arabic: ar,
                    translation: TRANSLATION_LOADING_PLACEHOLDER,
                  }),
                )
                setVerseEnrichmentStatus('text_ready')
              } else if (tr) {
                setDisplayAyah((prev) =>
                  fillSurahMeta({
                    ...prev,
                    translation: tr,
                  }),
                )
                setVerseEnrichmentStatus('text_ready')
              }

              queueMicrotask(() => {
                if (cancelled) return
                startTransition(() => {
                  setDisplayAyah((prev) =>
                    fillSurahMeta({
                      ...prev,
                      translation:
                        tr ||
                        (prev.translation === TRANSLATION_LOADING_PLACEHOLDER ? '…' : prev.translation),
                      audioUrl: au || prev.audioUrl,
                    }),
                  )
                  setVerseEnrichmentStatus('ready')
                  preloadAudioFromUrl(au)
                })
              })
            })
          })
          .catch(() => {
            if (!cancelled) {
              startTransition(() => {
                setDisplayAyah((prev) => fillSurahMeta(prev))
                setVerseEnrichmentStatus('unavailable')
              })
            }
          })
      },
      { timeoutMs: 400, delayMs: 0 },
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
      sessionUserTexts,
      sessionHistoryLoading,
      sessionHistoryError,
      refreshSessionChatStats,
      verseEnrichmentStatus,
      ayahsMarkedToday,
      syncAyahsMarkedToday,
    }),
    [
      displayAyah,
      refreshSessionChatStats,
      sessionTotalMessages,
      sessionUserMessages,
      sessionUserTexts,
      sessionHistoryLoading,
      sessionHistoryError,
      streakCount,
      syncStreakCount,
      verseEnrichmentStatus,
      ayahsMarkedToday,
      syncAyahsMarkedToday,
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
