import { Lightbulb, Link2, Moon } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../components/ui/Card'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { HistoryMessage } from '../lib/apiTypes'
import { buildInsightCards, type InsightCardModel } from '../lib/deriveInsights'
import { fillSurahMeta } from '../lib/mockData'

function iconFor(kind: InsightCardModel['kind']) {
  if (kind === 'themes') return Link2
  if (kind === 'rhythm') return Moon
  return Lightbulb
}

export function InsightsPage() {
  const { pathname } = useLocation()
  const { sessionId } = useAppSession()
  const { streakCount, displayAyah } = useMoodAyah()
  const [userTexts, setUserTexts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void apiClient
      .get<HistoryMessage[]>(`/history/${sessionId}`)
      .then(({ data }) => {
        if (cancelled) return
        const texts = data.filter((m) => m.role === 'user').map((m) => m.content.trim()).filter(Boolean)
        setUserTexts(texts)
      })
      .catch(() => {
        if (!cancelled) setUserTexts([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, pathname])

  const cards = useMemo(() => {
    const ayah = fillSurahMeta(displayAyah)
    return buildInsightCards({
      userMessages: userTexts,
      streakCount,
      heartCheckIns: userTexts.length,
      currentSurahName: ayah.surahName,
      currentVerseKey: `${ayah.surahId}:${ayah.ayahNumber}`,
    })
  }, [userTexts, streakCount, displayAyah])

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">AI insight results</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Three lenses built from your session: mood messages, streak, and the āyah currently highlighted on the
          dashboard.
        </p>
      </header>
      {loading ? (
        <p className="text-sm text-on-surface/60">Loading session signals…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => {
            const Icon = iconFor(card.kind)
            return (
              <Card key={card.title} className="flex gap-4 p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-semibold text-on-surface">{card.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-on-surface/70">{card.body}</p>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
