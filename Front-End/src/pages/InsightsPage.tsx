import { Lightbulb, Link2, Moon } from 'lucide-react'
import { useMemo } from 'react'
import { Card } from '../components/ui/Card'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import { buildInsightCards, buildInsightSubtitle, type InsightCardModel } from '../lib/deriveInsights'
import { fillSurahMeta } from '../lib/mockData'

function iconFor(kind: InsightCardModel['kind']) {
  if (kind === 'themes') return Link2
  if (kind === 'rhythm') return Moon
  return Lightbulb
}

export function InsightsPage() {
  const { sessionId } = useAppSession()
  const {
    streakCount,
    displayAyah,
    sessionUserTexts,
    sessionHistoryLoading,
    sessionHistoryError,
  } = useMoodAyah()

  const cards = useMemo(() => {
    const ayah = fillSurahMeta(displayAyah)
    return buildInsightCards({
      userMessages: sessionUserTexts,
      streakCount,
      heartCheckIns: sessionUserTexts.length,
      currentSurahName: ayah.surahName,
      currentVerseKey: `${ayah.surahId}:${ayah.ayahNumber}`,
      variantSeed: sessionId,
    })
  }, [sessionUserTexts, streakCount, displayAyah, sessionId])

  const subtitle = useMemo(() => {
    const ayah = fillSurahMeta(displayAyah)
    return buildInsightSubtitle({
      heartCheckIns: sessionUserTexts.length,
      streakCount,
      currentVerseKey: `${ayah.surahId}:${ayah.ayahNumber}`,
      currentSurahName: ayah.surahName,
    })
  }, [sessionUserTexts.length, streakCount, displayAyah])

  const showBlockingLoader = sessionHistoryLoading && sessionUserTexts.length === 0
  const showUpdating = sessionHistoryLoading && sessionUserTexts.length > 0

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">AI insight results</h1>
        <p className="mt-2 text-sm text-on-surface/70">{subtitle}</p>
        {sessionHistoryError ? (
          <p className="mt-1 text-xs text-on-surface-variant/80">
            Session history could not be refreshed; showing the last loaded signals.
          </p>
        ) : null}
        {showUpdating ? (
          <p className="mt-1 text-xs text-on-surface-variant/70" aria-live="polite">
            Updating session…
          </p>
        ) : null}
      </header>
      {showBlockingLoader ? (
        <p className="text-sm text-on-surface/60">Syncing session signals…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => {
            const Icon = iconFor(card.kind)
            return (
              <Card key={card.kind} className="flex gap-4 p-6">
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
