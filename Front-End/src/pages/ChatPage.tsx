import { Send, Share2, Trash2 } from 'lucide-react'
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
import { ChatSamplePromptsCollapsible } from '../components/ChatSamplePromptsCollapsible'
import { allChatSamplePrompts } from '../lib/chatSamplePrompts'
import { shareVerse } from '../lib/shareVerse'
import {
  CHAT_REPLY_LANGUAGE_OPTIONS,
  CHAT_VERSE_TRANSLATION_OPTIONS,
  loadChatReplyLanguage,
  loadChatVerseTranslation,
  resolveAnswerLanguage,
  resolveTranslationResourceId,
  saveChatReplyLanguage,
  saveChatVerseTranslation,
  type ChatReplyLanguageValue,
  type ChatVerseTranslationValue,
} from '../lib/chatPreferences'

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
  const appUrl = `${window.location.origin}/chat`
  return (
    <article
      className="rounded-xl border border-outline-variant/15 bg-surface-container-highest/50 p-3 text-left shadow-sm"
      lang="ar"
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() =>
            void shareVerse({
              arabic: v.ayah,
              reference: v.reference,
              translation: v.translation,
              url: appUrl,
            })
          }
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary/80 hover:bg-primary/10 hover:text-primary"
        >
          <Share2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Share
        </button>
      </div>
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
  const [clearing, setClearing] = useState(false)
  const [replyLanguage, setReplyLanguage] = useState<ChatReplyLanguageValue>(() => loadChatReplyLanguage())
  const [verseTranslation, setVerseTranslation] = useState<ChatVerseTranslationValue>(() =>
    loadChatVerseTranslation(),
  )
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
    saveChatReplyLanguage(replyLanguage)
  }, [replyLanguage])

  useEffect(() => {
    saveChatVerseTranslation(verseTranslation)
  }, [verseTranslation])

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
        const answer_language = resolveAnswerLanguage(replyLanguage)
        const translation_resource_id = resolveTranslationResourceId(verseTranslation)
        const { data } = await apiClient.post<ChatMessageResponse>('/chat/message', {
          session_id: sessionId,
          history,
          message: t,
          answer_language,
          ...(translation_resource_id != null ? { translation_resource_id } : {}),
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
    [rows, refreshSessionChatStats, replyLanguage, sending, sessionId, verseTranslation],
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

  const clearChat = useCallback(async () => {
    if (clearing || sending || hydrating) return
    if (
      !window.confirm(
        'Clear this conversation? All messages in this thread are removed from your session and cannot be recovered.',
      )
    )
      return
    setClearing(true)
    try {
      await apiClient.delete(`/history/${sessionId}`)
      setRows([])
      void refreshSessionChatStats()
    } catch (e) {
      window.alert(apiErrorMessage(e, 'Could not clear chat. Try again.'))
    } finally {
      setClearing(false)
    }
  }, [clearing, hydrating, refreshSessionChatStats, sending, sessionId])

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col px-3 sm:px-4">
      {/* Single card: everything inside the box; only the thread scrolls */}
      <div className="flex min-h-0 max-h-full flex-1 flex-col overflow-hidden rounded-bento border border-outline-variant/25 bg-surface-container-low shadow-ambient">
        <header className="shrink-0 border-b border-outline-variant/15 px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-serif text-xl font-semibold text-primary sm:text-2xl">Quran companion</h1>
              <p className="mt-1.5 text-xs leading-snug text-on-surface/65 sm:text-sm">
                Grounded verses when the API finds them; streak unchanged.{' '}
                <strong className="font-medium text-on-surface/80">Focus mode</strong> is read-only—chat here only.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-[11rem]">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/80">
                    Reply language
                  </span>
                  <select
                    value={replyLanguage}
                    onChange={(e) => setReplyLanguage(e.target.value as ChatReplyLanguageValue)}
                    disabled={sending || hydrating}
                    className="rounded-lg border border-outline-variant/25 bg-surface-container-highest/60 px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                  >
                    {CHAT_REPLY_LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-[14rem]">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/80">
                    Verse translation
                  </span>
                  <select
                    value={verseTranslation}
                    onChange={(e) => setVerseTranslation(e.target.value as ChatVerseTranslationValue)}
                    disabled={sending || hydrating}
                    className="rounded-lg border border-outline-variant/25 bg-surface-container-highest/60 px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
                  >
                    {CHAT_VERSE_TRANSLATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            {!hydrating && rows.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                className="shrink-0 gap-1.5 px-3 py-2 text-xs text-on-surface-variant hover:text-primary"
                disabled={sending || clearing}
                onClick={() => void clearChat()}
                title="Remove all messages in this thread"
                aria-label="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Clear chat</span>
              </Button>
            ) : null}
          </div>
        </header>

        <div
          ref={listRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 [scrollbar-gutter:stable]"
        >
          <div className="flex min-h-min flex-col gap-3 py-3">
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
        <div className="flex shrink-0 gap-2 border-t border-outline-variant/15 bg-surface-container-low px-4 py-3 sm:px-5">
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
        {!hydrating && rows.length > 0 ? (
          <ChatSamplePromptsCollapsible
            prompts={allChatSamplePrompts}
            disabled={sending}
            defaultOpen={false}
            onPick={(text) => void sendMessage(text)}
          />
        ) : null}
      </div>
    </div>
  )
}
