import { Lightbulb, Moon, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Card } from '../components/ui/Card'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { InsightsResponse } from '../lib/apiTypes'

function iconFor(kind: string) {
  if (kind === 'themes') return Sparkles
  if (kind === 'rhythm') return Moon
  return Lightbulb
}

export function InsightsPage() {
  const { sessionId } = useAppSession()
  const { sessionHistoryLoading, sessionHistoryError } = useMoodAyah()
  
  const [insights, setInsights] = useState<InsightsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient.get<InsightsResponse>(`/chat/insights?session_id=${sessionId}`)
      .then(({ data }) => {
        if (!cancelled) {
          setInsights(data)
          setError(null)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError('Could not reach the wisdom engine. Showing local signals.')
          console.error(err)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    
    return () => { cancelled = true }
  }, [sessionId])

  const showBlockingLoader = (sessionHistoryLoading || loading) && !insights
  const showUpdating = (sessionHistoryLoading || loading) && !!insights

  const cards = insights?.cards || []
  const subtitle = insights?.subtitle || 'Contextual wisdom curated for your current spiritual state.'

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-10 text-center sm:mb-12">
        <div className="mb-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-primary/10" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Spiritual Intelligence
          </span>
          <div className="h-px flex-1 bg-primary/10" />
        </div>
        <h1 className="font-serif text-3xl font-semibold text-primary sm:text-4xl md:text-5xl">
          AI Insight Results
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-on-surface/60 sm:text-base">
          {subtitle}
        </p>
        {(sessionHistoryError || error) ? (
          <p className="mt-3 text-xs text-error/80">
            {error || 'Session history could not be refreshed; showing local signals.'}
          </p>
        ) : null}
        {showUpdating ? (
          <div className="mt-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-secondary animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary" />
              Syncing Heart Signals…
            </span>
          </div>
        ) : null}
      </header>

      {showBlockingLoader ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/10 border-t-primary" />
          <p className="text-sm font-medium text-on-surface/40">Calibrating insights…</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 auto-rows-[minmax(160px,auto)] sm:grid-cols-2 md:grid-cols-3">
          {cards.map((card, idx) => {
            const Icon = iconFor(card.kind)
            const isHero = card.kind === 'themes' || (idx === 0 && cards.length === 1)
            
            return (
              <Card 
                key={`${card.kind}-${idx}`} 
                className={`
                  group relative flex flex-col overflow-hidden p-6 transition-all duration-500 ease-out hover:translate-y-[-4px] sm:p-8
                  ${isHero ? 'sm:col-span-2 md:row-span-2 bg-surface-container-lowest' : 'bg-surface-container-low/50 border-none shadow-none'}
                `}
              >
                {/* Decorative background flourish for Hero */}
                {isHero && (
                  <div className="absolute right-[-10%] top-[-20%] h-64 w-64 rounded-full bg-primary/5 blur-3xl transition-colors duration-700 group-hover:bg-primary/10" />
                )}
                
                <div className={`
                  mb-6 flex h-12 w-12 items-center justify-center rounded-2xl 
                  ${isHero ? 'bg-primary text-white shadow-primary-soft' : 'bg-secondary/15 text-secondary'}
                `}>
                  <Icon className={`${isHero ? 'h-6 w-6' : 'h-5 w-5'}`} aria-hidden />
                </div>

                <div className="relative z-10">
                  <h2 className={`
                    mb-3 font-serif font-semibold text-on-surface
                    ${isHero ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-xl sm:text-2xl'}
                  `}>
                    {card.title}
                  </h2>
                  <p className={`
                    leading-relaxed text-on-surface/70
                    ${isHero ? 'text-base sm:text-lg lg:text-xl' : 'text-sm sm:text-base'}
                  `}>
                    {card.body}
                  </p>
                </div>

                {isHero && (
                  <div className="mt-auto flex items-center gap-2 pt-8">
                    <span className="h-px flex-1 bg-primary/10" />
                    <Sparkles className="h-4 w-4 text-secondary/40" />
                    <span className="h-px flex-1 bg-primary/10" />
                  </div>
                )}
              </Card>
            )
          })}

          {/* Fallback card if fewer than 3 insights to maintain bento feel */}
          {cards.length < 3 && cards.length > 0 && (
            <div className="flex flex-col items-center justify-center rounded-bento border-2 border-dashed border-primary/5 p-8 text-center opacity-40 sm:col-span-1">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/5">
                <Sparkles className="h-5 w-5 text-primary/30" />
              </div>
              <p className="text-xs font-medium uppercase tracking-widest text-primary/40">
                More Signals Needed
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer Reflection Quote */}
      <footer className="mt-20 text-center">
        <blockquote className="font-serif text-lg italic text-primary/40">
          “Verily, in the remembrance of Allah do hearts find rest.”
        </blockquote>
      </footer>
    </div>
  )
}
