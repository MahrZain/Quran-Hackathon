/* Context + hook: Fast Refresh allows dual export here for app state. */
/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { isAxiosError } from 'axios'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { ChatResponse } from '../lib/apiTypes'
import { type DailyAyah, findAyahForMood, getDailyAyahForToday } from '../lib/mockData'

type MoodAyahContextValue = {
  displayAyah: DailyAyah
  setDisplayAyah: (ayah: DailyAyah) => void
  runMoodSearch: (mood: string) => void
  moodLoading: boolean
  aiReflection: string | null
  clearAiReflection: () => void
}

const MoodAyahContext = createContext<MoodAyahContextValue | null>(null)

export function MoodAyahProvider({ children }: { children: ReactNode }) {
  const { sessionId } = useAppSession()
  const [displayAyah, setDisplayAyah] = useState<DailyAyah>(() => getDailyAyahForToday())
  const [moodLoading, setMoodLoading] = useState(false)
  const [aiReflection, setAiReflection] = useState<string | null>(null)

  const clearAiReflection = useCallback(() => setAiReflection(null), [])

  const runMoodSearch = useCallback(
    async (mood: string) => {
      const trimmed = mood.trim()
      if (!trimmed || moodLoading) return
      setMoodLoading(true)
      setAiReflection(null)
      try {
        const { data } = await apiClient.post<ChatResponse>('/chat', {
          session_id: sessionId,
          message: trimmed,
        })
        setAiReflection(data.ai_reply)
        setDisplayAyah(findAyahForMood(trimmed))
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
    [moodLoading, sessionId],
  )

  const value = useMemo(
    () => ({
      displayAyah,
      setDisplayAyah,
      runMoodSearch,
      moodLoading,
      aiReflection,
      clearAiReflection,
    }),
    [aiReflection, clearAiReflection, displayAyah, moodLoading, runMoodSearch],
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
