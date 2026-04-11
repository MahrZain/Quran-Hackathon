import { Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../components/ui/Button'

type Msg = { role: 'user' | 'mentor'; text: string }

const seed: Msg[] = [
  {
    role: 'mentor',
    text: 'Peace. Ask about meaning, context, or how to sit with an āyah—short questions keep the sanctuary clear.',
  },
]

export function MentorPage() {
  const [messages, setMessages] = useState<Msg[]>(seed)
  const [draft, setDraft] = useState('')

  function send() {
    const t = draft.trim()
    if (!t) return
    setMessages((m) => [...m, { role: 'user', text: t }])
    setDraft('')
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: 'mentor',
          text: 'This is a static UI shell. Connect your model or backend to stream real answers with adab.',
        },
      ])
    }, 400)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col" style={{ minHeight: 'calc(100svh - 8rem)' }}>
      <header className="mb-4">
        <h1 className="font-serif text-2xl font-semibold text-primary">AI sanctuary mentor</h1>
        <p className="text-sm text-on-surface/65">Mobile-first chat layout from Stitch.</p>
      </header>

      <div className="flex flex-1 flex-col gap-3 rounded-bento bg-surface-container-low p-4 shadow-ambient">
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((msg, i) => (
            <div
              key={`${msg.role}-${i}`}
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-auto bg-primary-container text-on-primary'
                  : 'mr-auto bg-surface-container-highest/80 text-on-surface'
              }`}
            >
              {msg.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2 border-t border-outline-variant/10 pt-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Ask with clarity…"
            className="min-w-0 flex-1 rounded-xl border-0 bg-surface-container-highest/50 px-4 py-3 text-sm text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
          />
          <Button type="button" variant="primary" className="shrink-0 px-4" onClick={send}>
            <Send className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
