import { Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChatThinkingIndicator } from '../components/ChatThinkingIndicator'
import { Button } from '../components/ui/Button'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { ChatMessageResponse, ChatVerseCard, HistoryMessage } from '../lib/apiTypes'
import { useMoodAyah } from '../context/MoodAyahContext'
import { apiErrorMessage } from '../lib/apiErrors'

type Msg =
  | { role: 'user'; text: string }
  | { role: 'mentor'; text: string; verses?: ChatVerseCard[] }

const WELCOME: Msg = {
  role: 'mentor',
  text: 'Assalamu alaykum. This is a quiet corner for questions about an ayah, tafsir, or the state of the heart—answers stay humble, clear, and mindful of adab.',
}

function AyahCard({ v }: { v: ChatVerseCard }) {
  return (
    <article
      className="rounded-xl border border-outline-variant/15 bg-surface-container-highest/50 p-3 text-left shadow-sm"
      lang="ar"
    >
      <p className="quran-mushaf text-lg leading-relaxed text-on-surface" dir="rtl">
        {v.ayah}
      </p>
      <p className="mt-2 text-xs font-semibold tracking-wide text-primary" dir="ltr">
        {v.reference}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-on-surface/85" dir="ltr" lang="en">
        {v.translation}
      </p>
    </article>
  )
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
  const { refreshSessionChatStats } = useMoodAyah()
  const [messages, setMessages] = useState<Msg[]>([WELCOME])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, sending, scrollToBottom])

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
      const history = messages
        .filter((m) => !(m.role === 'mentor' && m.text === WELCOME.text))
        .map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }))
      const { data } = await apiClient.post<ChatMessageResponse>('/chat/message', {
        session_id: sessionId,
        history,
        message: t,
      })
      setMessages((m) => [
        ...m,
        {
          role: 'mentor',
          text: data.answer,
          verses: data.verses?.length ? data.verses : undefined,
        },
      ])
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
  }, [draft, messages, refreshSessionChatStats, sending, sessionId])

  return (
    <div className="mx-auto flex max-w-xl flex-col px-4" style={{ minHeight: 'calc(100svh - 8rem)' }}>
      <header className="mb-4">
        <h1 className="font-serif text-2xl font-semibold text-primary">AI sanctuary mentor</h1>
        <p className="text-sm text-on-surface/65">
          Messages are kept in your session and appear in Insights. Take your time; a thoughtful reply may take a few
          seconds.
        </p>
      </header>

      <div className="flex flex-1 flex-col gap-3 rounded-bento bg-surface-container-low p-4 shadow-ambient">
        <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {hydrating ? (
            <p className="text-center text-sm text-on-surface/55">Loading your conversation…</p>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={`m-${i}`} className="flex flex-col gap-2">
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'ml-auto bg-primary-container text-on-primary'
                        : 'mr-auto bg-surface-container-highest/80 text-on-surface'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === 'mentor' && msg.verses && msg.verses.length > 0 ? (
                    <div className="mr-auto flex max-w-[95%] flex-col gap-2 pl-0 sm:pl-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                        Grounded verses
                      </p>
                      <div className="grid gap-2">
                        {msg.verses.map((v) => (
                          <AyahCard key={`${i}-${v.reference}`} v={v} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {sending ? <ChatThinkingIndicator /> : null}
            </>
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
