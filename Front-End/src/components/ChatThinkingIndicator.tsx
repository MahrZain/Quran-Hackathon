import { m } from 'framer-motion'

/** Shown while the assistant request is in flight so the thread does not feel frozen. */
export function ChatThinkingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mr-auto flex max-w-[min(90%,26rem)] items-start gap-3 rounded-2xl border border-primary/10 bg-surface-container-highest/80 px-4 py-3 text-sm text-on-surface shadow-ambient"
    >
      <m.span
        className="mt-1.5 inline-flex h-2 w-2 shrink-0 rounded-full bg-primary"
        animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.12, 1] }}
        transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <div className="min-w-0 space-y-1">
        <p className="font-serif font-medium text-on-surface/95">Reflecting with adab…</p>
        <p className="text-xs leading-snug text-on-surface/55">
          Pausing with dhikr of the heart before your reply. A few seconds is normal; barakallahu feek.
        </p>
      </div>
    </div>
  )
}
