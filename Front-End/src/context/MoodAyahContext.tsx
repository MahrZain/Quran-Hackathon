/* Context + hook: Fast Refresh allows dual export here for app state. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAxiosError } from 'axios'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { ChatResponse, HistoryMessage } from '../lib/apiTypes'
import { asarE2eTrace } from '../lib/asarE2eTrace'
import { dailyAyahFromChatResponse } from '../lib/dailyAyahFromChat'
import { type DailyAyah, findAyahForMood, getDailyAyahForToday } from '../lib/mockData'

type MoodAyahContextValue = {
  displayAyah: DailyAyah
  setDisplayAyah: (ayah: DailyAyah) => void
  runMoodSearch: (mood: string) => void
  moodLoading: boolean
  aiReflection: string | null
  clearAiReflection: () => void
  /** Streak from API (chat, mark complete, or dashboard hydrate). */
  streakCount: number
  syncStreakCount: (n: number) => void
  /** Session chat rows from GET /history (refreshed after each successful /chat). */
  sessionUserMessages: number
  sessionTotalMessages: number
  refreshSessionChatStats: () => Promise<void>
}

const MoodAyahContext = createContext<MoodAyahContextValue | null>(null)

export function MoodAyahProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAppSession()
  const [displayAyah, setDisplayAyah] = useState<DailyAyah>(() => getDailyAyahForToday())
  const [moodLoading, setMoodLoading] = useState(false)
  const [aiReflection, setAiReflection] = useState<string | null>(null)
  const [streakCount, setStreakCount] = useState(0)
  const [sessionUserMessages, setSessionUserMessages] = useState(0)
  const [sessionTotalMessages, setSessionTotalMessages] = useState(0)

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

  const clearAiReflection = useCallback(() => setAiReflection(null), [])

  const runMoodSearch = useCallback(
    async (mood: string) => {
      const trimmed = mood.trim()
      if (!trimmed || moodLoading) return
      setMoodLoading(true)
      setAiReflection(null)
      try {
        asarE2eTrace('STEP 2 — POST /chat request', {
          session_id: sessionId,
          message_len: trimmed.length,
        })
        const { data } = await apiClient.post<ChatResponse>('/chat', {
          session_id: sessionId,
          message: trimmed,
        })
        asarE2eTrace('STEP 2–3 — POST /chat response', {
          reply_len: data.ai_reply?.length,
          updated_streak_count: data.updated_streak_count,
          verse_key: data.verse_key,
          has_audio: Boolean(data.audio_url),
          uthmani_len: data.verse_text_uthmani?.length ?? 0,
        })
        setAiReflection(data.ai_reply)
        syncStreakCount(data.updated_streak_count)
        const moodAyah = findAyahForMood(trimmed)
        setDisplayAyah(dailyAyahFromChatResponse(data, moodAyah))
        void refreshSessionChatStats()
      } catch (e) {
        let msg = ''
        if (isAxiosError(e)) {
          const det = e.response?.data && typeof e.response.data === 'object' && 'detail' in e.response.data
            ? (e.response.data as { detail: unknown }).detail
            : undefined
          if (typeof det === 'string') msg = det
          else if (Array.isArray(det)) msg = det.map((x) => JSON.stringify(x)).join('; ')
        }
        setAiReflection(
          msg ||
            'Could not reach ASAR Engine. Start the API on port 8000 and check CORS (see VITE_API_BASE_URL).',
        )
      } finally {
        setMoodLoading(false)
      }
    },
    [moodLoading, sessionId, syncStreakCount, refreshSessionChatStats],
  )

  const value = useMemo(
    () => ({
      displayAyah,
      setDisplayAyah,
      runMoodSearch,
      moodLoading,
      aiReflection,
      clearAiReflection,
      streakCount,
      syncStreakCount,
      sessionUserMessages,
      sessionTotalMessages,
      refreshSessionChatStats,
    }),
    [
      aiReflection,
      clearAiReflection,
      displayAyah,
      moodLoading,
      runMoodSearch,
      refreshSessionChatStats,
      sessionTotalMessages,
      sessionUserMessages,
      streakCount,
      syncStreakCount,
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
