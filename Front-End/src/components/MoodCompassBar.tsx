import { m } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useMoodAyah } from '../context/MoodAyahContext'

/** Centered mood search for the app header (Mood Compass). */
export function MoodCompassBar() {
  const { runMoodSearch, moodLoading, aiReflection, clearAiReflection } = useMoodAyah()
  const [mood, setMood] = useState('')

  const handleAsk = () => {
    void runMoodSearch(mood)
  }

  const dismissReflection = () => {
    clearAiReflection()
    setMood('')
  }

  useEffect(() => {
    if (!aiReflection) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearAiReflection()
        setMood('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aiReflection, clearAiReflection])

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
        aria-label="Mood compass"
        value={mood}
        onChange={(e) => setMood(e.target.value)}
        disabled={moodLoading}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleAsk()
        }}
      />
      <button
        type="button"
        onClick={handleAsk}
        disabled={moodLoading}
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-primary to-primary-container px-4 py-2 text-xs font-medium text-on-primary shadow-lg transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-65 sm:gap-2 sm:px-5 sm:text-sm"
      >
        {moodLoading ? (
          <>
            <m.span
              className="inline-flex h-2 w-2 rounded-full bg-on-primary"
              animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              aria-hidden
            />
            <span className="max-[380px]:sr-only">Thinking…</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-base sm:text-lg" aria-hidden>
              auto_awesome
            </span>
            <span className="whitespace-nowrap">Ask AI</span>
          </>
        )}
      </button>
    </div>
    {aiReflection && !moodLoading && (
      <div
        role="status"
        className="relative rounded-2xl border border-primary/15 bg-surface-container-low/95 px-4 py-3 pr-11 text-left text-sm leading-relaxed text-on-surface shadow-ambient"
      >
        <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-primary/80">Reflection</p>
        <p className="font-serif text-on-surface/90">{aiReflection}</p>
        <button
          type="button"
          onClick={dismissReflection}
          className="absolute right-2 top-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition hover:bg-surface-container-high/80 hover:text-on-surface"
          aria-label="Dismiss reflection"
        >
          <span className="material-symbols-outlined text-xl" aria-hidden>
            close
          </span>
        </button>
      </div>
    )}
    </div>
  )
}
