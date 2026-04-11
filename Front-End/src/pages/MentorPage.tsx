import { Send } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { ChatResponse, HistoryMessage } from '../lib/apiTypes'
import { useMoodAyah } from '../context/MoodAyahContext'
import { apiErrorMessage } from '../lib/apiErrors'

type Msg = { role: 'user' | 'mentor'; text: string }

const WELCOME: Msg = {
  role: 'mentor',
  text: 'Peace. This thread uses the same ASAR Engine as the mood compass—short questions about an āyah, tafsir, or the heart keep answers clear and adab-aware.',
}

function historyToMessages(rows: HistoryMessage[]): Msg[] {
  const out: Msg[] = []
  for (const m of rows) {
    if (m.role === 'user') out.push({ role: 'user', text: m.content })
    else out.push({ role: 'mentor', text: m.content })
  }
  return out
}

export function MentorPage() {
  const { sessionId } = useAppSession()
  const { refreshSessionChatStats, syncStreakCount } = useMoodAyah()
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    let cancelled = false
    setHydrating(true)
    void apiClient
      .get<HistoryMessage[]>(`/history/${sessionId}`)
      .then(({ data }) => {
        if (cancelled) return
        const mapped = historyToMessages(data)
        setMessages(mapped.length > 0 ? mapped : [WELCOME])
      })
      .catch(() => {
        if (!cancelled) setMessages([WELCOME])
      })
      .finally(() => {
        if (!cancelled) setHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const send = useCallback(async () => {
    const t = draft.trim()
    if (!t || sending) return
    setDraft('')
    setSending(true)
    setMessages((m) => [...m, { role: 'user', text: t }])
    try {
      const { data } = await apiClient.post<ChatResponse>('/chat', {
        session_id: sessionId,
        message: t,
      })
      setMessages((m) => [...m, { role: 'mentor', text: data.ai_reply }])
      syncStreakCount(data.updated_streak_count)
      void refreshSessionChatStats()
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: 'mentor',
          text: apiErrorMessage(e, 'Could not reach ASAR Engine. Start the API and try again.'),
        },
      ])
    } finally {
      setSending(false)
    }
  }, [draft, refreshSessionChatStats, sending, sessionId, syncStreakCount])

  return (
    <div className="mx-auto flex max-w-xl flex-col px-4" style={{ minHeight: 'calc(100svh - 8rem)' }}>
      <header className="mb-4">
        <h1 className="font-serif text-2xl font-semibold text-primary">AI sanctuary mentor</h1>
        <p className="text-sm text-on-surface/65">
          Same session as the compass bar—messages are stored and show up in Insights.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 rounded-bento bg-surface-container-low p-4 shadow-ambient">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {hydrating ? (
            <p className="text-center text-sm text-on-surface/55">Loading your conversation…</p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={`m-${i}`}
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-auto bg-primary-container text-on-primary'
                    : 'mr-auto bg-surface-container-highest/80 text-on-surface'
                }`}
              >
                {msg.text}
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2 border-t border-outline-variant/10 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
            placeholder="Ask with clarity…"
            disabled={sending || hydrating}
            className="min-w-0 flex-1 rounded-xl border-0 bg-surface-container-highest/50 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
          />
          <Button
            type="button"
            variant="primary"
            className="shrink-0 px-4"
            disabled={sending || hydrating || !draft.trim()}
            onClick={() => void send()}
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
