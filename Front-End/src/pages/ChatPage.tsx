import { Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChatThinkingIndicator } from '../components/ChatThinkingIndicator'
import { Button } from '../components/ui/Button'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { ChatMessageResponse, ChatVerseCard, HistoryMessage } from '../lib/apiTypes'
import { apiErrorMessage } from '../lib/apiErrors'
import { useAuth } from '../context/AuthContext'
import { useMoodAyah } from '../context/MoodAyahContext'
import { ChatSamplePrompts } from '../components/ChatSamplePrompts'
import { allChatSamplePrompts } from '../lib/chatSamplePrompts'

type Row =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string; verses?: ChatVerseCard[] }

function historyToRows(rows: HistoryMessage[]): Row[] {
  const out: Row[] = []
  for (const m of rows) {
    if (m.role === 'user') out.push({ role: 'user', text: m.content })
    else out.push({ role: 'assistant', text: m.content })
  }
  return out
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

export function ChatPage() {
  const { user } = useAuth()
  const { sessionId } = useAppSession()
  const { refreshSessionChatStats } = useMoodAyah()
  const location = useLocation()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [hydrating, setHydrating] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  /** React Router location key — survives Strict Mode remounts so we only auto-send once per navigation. */
  const initialHandledKeyRef = useRef<string | null>(null)

  const scrollToBottom = useCallback(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [rows, scrollToBottom])

  useEffect(() => {
    let cancelled = false
    setHydrating(true)
    void apiClient
      .get<HistoryMessage[]>(`/history/${sessionId}`)
      .then(({ data }) => {
        if (cancelled) return
        setRows(historyToRows(data))
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
      .finally(() => {
        if (!cancelled) setHydrating(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  const sendMessage = useCallback(
    async (text: string) => {
      const t = text.trim()
      if (!t || sending) return
      setSending(true)
      const history = rows.map((r) => ({
        role: r.role,
        content: r.text,
      }))
      setRows((prev) => [...prev, { role: 'user', text: t }])
      try {
        const { data } = await apiClient.post<ChatMessageResponse>('/chat/message', {
          session_id: sessionId,
          history,
          message: t,
        })
        setRows((prev) => [
          ...prev,
          { role: 'assistant', text: data.answer, verses: data.verses?.length ? data.verses : undefined },
        ])
        void refreshSessionChatStats()
      } catch (e) {
        setRows((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: apiErrorMessage(e, 'Could not reach ASAR Engine. Start the API and try again.'),
          },
        ])
      } finally {
        setSending(false)
      }
    },
    [rows, refreshSessionChatStats, sending, sessionId],
  )

  useEffect(() => {
    const q = (location.state as { initialQuery?: string } | null)?.initialQuery?.trim()
    if (!q || hydrating) return
    if (initialHandledKeyRef.current === location.key) return
    initialHandledKeyRef.current = location.key
    navigate(location.pathname, { replace: true, state: {} })
    void sendMessage(q)
  }, [hydrating, location.key, location.pathname, location.state, navigate, sendMessage])

  const sendDraft = useCallback(() => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    void sendMessage(t)
  }, [draft, sendMessage])

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col px-4">
      <header className="mb-3 shrink-0">
        <h1 className="font-serif text-2xl font-semibold text-primary">Quran companion</h1>
        <p className="text-sm text-on-surface/65">
          Your only ASAR chat for this session—grounded verses when the API finds matches; streak is unchanged here.{' '}
          <strong className="font-medium text-on-surface/80">Focus mode</strong> is read-only (verse only); open this
          page to ask questions.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden rounded-bento bg-surface-container-low p-4 shadow-ambient">
        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable]"
        >
          <div className="flex min-h-min flex-col gap-3">
          {hydrating ? (
            <p className="text-center text-sm text-on-surface/55">Loading your conversation…</p>
          ) : rows.length === 0 && !sending ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-on-surface/55">
                Ask about a theme, a surah name, or paste a verse reference (e.g. 2:286). Replies stay within the verses
                shown below each answer when available.
              </p>
              <ChatSamplePrompts
                prompts={allChatSamplePrompts}
                disabled={sending || hydrating}
                onPick={(text) => void sendMessage(text)}
                className="w-full max-w-md"
              />
              {user?.onboarding_topic_tag ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="max-w-xs text-xs"
                  disabled={sending || hydrating}
                  onClick={() =>
                    void sendMessage(
                      `Please help me reflect on "${user.onboarding_topic_tag}" with relevant Quranic verses.`,
                    )
                  }
                >
                  Start with my onboarding theme
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              {rows.map((msg, i) => (
                <div key={`r-${i}-${msg.text.slice(0, 12)}`} className="flex flex-col gap-2">
                  <div
                    className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'ml-auto bg-primary-container text-on-primary'
                        : 'mr-auto bg-surface-container-highest/80 text-on-surface'
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === 'assistant' && msg.verses && msg.verses.length > 0 ? (
                    <div className="mr-auto flex max-w-[95%] flex-col gap-2 pl-0 sm:pl-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/70">
                        Grounded verses
                      </p>
                      <div className="grid gap-2 sm:grid-cols-1">
                        {msg.verses.map((v) => (
                          <AyahCard key={`${i}-${v.reference}`} v={v} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
              {!hydrating && sending ? <ChatThinkingIndicator /> : null}
            </>
          )}
          </div>
        </div>
        {!hydrating && rows.length > 0 ? (
          <ChatSamplePrompts
            prompts={allChatSamplePrompts}
            disabled={sending}
            onPick={(text) => void sendMessage(text)}
            className="shrink-0 border-t border-outline-variant/10 pt-3"
          />
        ) : null}
        <div className="flex shrink-0 gap-2 border-t border-outline-variant/10 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendDraft()
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
            onClick={() => void sendDraft()}
          >
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
