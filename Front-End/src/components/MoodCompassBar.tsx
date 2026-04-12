import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

/** Centered “Ask AI” router in the app header — opens dedicated verified chat. */
export function MoodCompassBar() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleAsk = () => {
    const trimmed = query.trim()
    if (!trimmed) return
    navigate('/chat', { state: { initialQuery: trimmed } })
    setQuery('')
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-2">
      <div className="flex w-full items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low/90 px-3 py-2 shadow-ambient backdrop-blur-sm transition-[box-shadow,border-color] focus-within:border-primary/30 focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary/15 sm:gap-3 sm:px-4">
        <span className="material-symbols-outlined shrink-0 text-xl text-secondary sm:text-2xl" aria-hidden>
          favorite
        </span>
        <input
          className="font-headline min-w-0 flex-1 border-none bg-transparent text-sm italic text-on-surface/85 outline-none placeholder:text-on-surface/35 focus:outline-none focus:ring-0 sm:text-base"
          placeholder="How is your heart today?"
          type="text"
          inputMode="text"
          enterKeyHint="send"
          autoComplete="off"
          aria-label="Ask AI — opens chat"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk()
          }}
        />
        <button
          type="button"
          onClick={handleAsk}
          disabled={!query.trim()}
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-xs font-medium text-on-primary shadow-lg transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-65 sm:gap-2 sm:px-5 sm:text-sm"
        >
          <span className="material-symbols-outlined text-base sm:text-lg" aria-hidden>
            auto_awesome
          </span>
          <span className="whitespace-nowrap">Ask AI</span>
        </button>
      </div>
    </div>
  )
}
