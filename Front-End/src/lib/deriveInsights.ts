/**
 * Lightweight, deterministic “insight” copy from real session data (no extra LLM call).
 */

const THEME_GROUPS: { label: string; patterns: RegExp[] }[] = [
  { label: 'rizq and trust in provision', patterns: [/rizq|provision|wealth|job|money|sustain/i] },
  { label: 'sabr and steadiness', patterns: [/sabr|patient|wait|endur|slow|hard day/i] },
  { label: 'gratitude and contentment', patterns: [/grateful|thank|shukr|bless|calm|peace|light/i] },
  { label: 'fear and anxiety', patterns: [/fear|anxious|worry|stress|nervous|panic/i] },
  { label: 'grief and heaviness', patterns: [/grief|sad|heavy|hurt|loss|tired|lonely/i] },
  { label: 'hope and renewal', patterns: [/hope|renew|begin|mercy|forgive|tawba/i] },
]

export type InsightCardModel = {
  title: string
  body: string
  kind: 'themes' | 'rhythm' | 'prompt'
}

export function buildInsightCards(input: {
  userMessages: string[]
  streakCount: number
  heartCheckIns: number
  currentSurahName: string
  currentVerseKey: string
}): InsightCardModel[] {
  const blob = input.userMessages.join(' ').toLowerCase()

  const matchedThemes: string[] = []
  for (const g of THEME_GROUPS) {
    if (g.patterns.some((re) => re.test(blob))) {
      matchedThemes.push(g.label)
    }
  }

  const thematic =
    matchedThemes.length > 0
      ? `From your recent heart check-ins, words cluster around ${matchedThemes.slice(0, 3).join(', ')}. Journaling one honest line per theme can help ASAR’s mentor stay precise.`
      : input.heartCheckIns > 0
        ? 'Keep sharing short moods in the compass bar—when themes repeat, they will surface here as anchors for reflection.'
        : 'No mood messages yet. Try one line in the compass (“How is your heart today?”) so insights can echo your language.'

  const rhythm =
    input.heartCheckIns > 0
      ? `This session has ${input.heartCheckIns} heart check-in${input.heartCheckIns === 1 ? '' : 's'} with ASAR. A steady rhythm—even brief—often pairs well with one āyah and one du'a per day.`
      : input.streakCount > 0
        ? `Your logged streak is ${input.streakCount} day${input.streakCount === 1 ? '' : 's'}. Marking an āyah complete after dhikr keeps the loop visible on the dashboard.`
        : 'Start with “Mark complete” on the dashboard after a short read, then revisit the mentor—continuity builds clearer guidance.'

  const verseKey = (input.currentVerseKey || '').trim()
  const hasVerseKey = /^\d+:\d+$/.test(verseKey)
  const surahLabel = (input.currentSurahName || '').trim()
  const prompt = hasVerseKey
    ? surahLabel
      ? `Your spotlight āyah is ${surahLabel} (${verseKey}). Try one narrow question for the mentor about that verse only—context stays grounded and answers stay short.`
      : `Your spotlight āyah is ${verseKey}. Try one narrow question for the mentor about that verse only—context stays grounded and answers stay short.`
    : 'Open Quran progress, pick a surah, then ask the mentor about a single āyah—narrow questions keep the sanctuary clear.'

  return [
    { title: 'Thematic echo', body: thematic, kind: 'themes' },
    { title: 'Session rhythm', body: rhythm, kind: 'rhythm' },
    { title: 'Gentle prompt', body: prompt, kind: 'prompt' },
  ]
}
