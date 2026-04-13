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

function stableHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function pickVariant<T>(variants: readonly T[], seed: string): T {
  if (variants.length === 0) throw new Error('variants empty')
  return variants[stableHash(seed) % variants.length]
}

function trimSnippet(line: string, maxLen: number): string {
  const t = line.trim().replace(/\s+/g, ' ')
  if (t.length <= maxLen) return t
  return `${t.slice(0, maxLen - 1)}…`
}

const THEMATIC_WITH_THEMES: readonly string[] = [
  'From your recent heart check-ins, words cluster around {themes}. Journaling one honest line per theme can help Quran companion stay precise.',
  'Your check-ins keep circling {themes}. Naming that pattern in one line per theme helps Quran companion stay aligned with you.',
  'Themes like {themes} show up in what you’ve shared. Short notes on each give ASAR a steadier map for guidance.',
]

const THEMATIC_NO_THEMES_HAS_CHECKS: readonly string[] = [
  'Keep sharing short moods in the compass bar—when themes repeat, they will surface here as anchors for reflection.',
  'Each brief check-in adds signal. As patterns repeat, this card will echo them so reflection stays grounded.',
  'Light, honest lines add up. When a theme repeats, it will appear here to anchor your next chat in Quran companion.',
]

const THEMATIC_EMPTY: readonly string[] = [
  'No mood messages yet. Try one line in the compass (“How is your heart today?”) so insights can echo your language.',
  'When you add a first mood line in the compass, this space will start reflecting your words back to you.',
  'Share a single honest line about your heart today—insights grow from those small check-ins.',
]

const RHYTHM_WITH_CHECKS: readonly string[] = [
  'This session has {n} heart check-in{s} with ASAR. A steady rhythm—even brief—often pairs well with one āyah and one du\'a per day.',
  '{n} check-in{s} so far this session. Small, regular notes plus one verse a day can keep the loop gentle and clear.',
  'You’ve logged {n} heart check-in{s} here. Pairing that rhythm with one āyah and a short du\'a often feels sustainable.',
]

const RHYTHM_STREAK: readonly string[] = [
  'Your logged streak is {streak} day{s}. Marking an āyah complete after dhikr keeps the loop visible on the dashboard.',
  '{streak} day{s} on your streak. Tying a short read to “Mark complete” keeps progress visible without pressure.',
  'Streak at {streak} day{s}. One āyah marked complete after remembrance keeps the dashboard honest and kind.',
]

const RHYTHM_START: readonly string[] = [
  'Start with “Mark complete” on the dashboard after a short read, then open Quran companion—continuity builds clearer guidance.',
  'Try a brief read, tap Mark complete, then open Quran companion when you’re ready—small loops compound.',
  'One short read, one mark complete, then Quran companion when it helps—that’s enough to build continuity.',
]

const PROMPT_WITH_SURAH: readonly string[] = [
  'Your spotlight āyah is {surah} ({key}). Try one narrow question in Quran companion about that verse only—context stays grounded and answers stay short.',
  'Dashboard spotlight: {surah} ({key}). Ask one focused question in Quran companion on that āyah so replies stay tight and relevant.',
  'You’re on {surah} ({key}). A single, verse-specific question keeps your chat anchored and answers brief.',
]

const PROMPT_KEY_ONLY: readonly string[] = [
  'Your spotlight āyah is {key}. Try one narrow question in Quran companion about that verse only—context stays grounded and answers stay short.',
  'Spotlight {key}. One specific question about that āyah keeps answers short and on-topic.',
  'Focus question on {key} only—Quran companion stays grounded when the scope is one verse.',
]

const PROMPT_NO_KEY: readonly string[] = [
  'Open Quran progress, pick a surah, then ask in Quran companion about a single āyah—narrow questions keep the sanctuary clear.',
  'Choose one āyah in the reader, then ask about that verse alone—tight scope keeps guidance calm.',
  'Ground Quran companion in one verse at a time; broad questions are harder to answer well in one pass.',
]

function fillTemplate(tpl: string, vars: Record<string, string | number>): string {
  let out = tpl
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{${k}}`).join(String(v))
  }
  return out
}

export type BuildInsightCardsInput = {
  userMessages: string[]
  streakCount: number
  heartCheckIns: number
  currentSurahName: string
  currentVerseKey: string
  /** Stable id so copy variants don’t flicker (e.g. session id). */
  variantSeed?: string
}

export function buildInsightSubtitle(input: {
  heartCheckIns: number
  streakCount: number
  currentVerseKey: string
  currentSurahName: string
}): string {
  const verseKey = (input.currentVerseKey || '').trim()
  const hasVerseKey = /^\d+:\d+$/.test(verseKey)
  const surah = (input.currentSurahName || '').trim()
  const parts: string[] = []
  if (input.heartCheckIns > 0) {
    parts.push(
      `${input.heartCheckIns} heart check-in${input.heartCheckIns === 1 ? '' : 's'} this session`,
    )
  } else {
    parts.push('No check-ins this session yet')
  }
  if (input.streakCount > 0) {
    parts.push(`${input.streakCount}-day streak`)
  }
  if (hasVerseKey) {
    parts.push(surah ? `Spotlight ${surah} (${verseKey})` : `Spotlight ${verseKey}`)
  } else {
    parts.push('Pick a spotlight āyah on the dashboard')
  }
  if (parts.length === 3) {
    return `${parts[0]} · ${parts[1]} · ${parts[2]}`
  }
  return parts.join(' · ')
}

export function buildInsightCards(input: BuildInsightCardsInput): InsightCardModel[] {
  const blob = input.userMessages.join(' ').toLowerCase()
  const seedBase = `${input.variantSeed ?? 'default'}|${input.currentVerseKey}|${input.userMessages.length}`

  const matchedThemes: string[] = []
  for (const g of THEME_GROUPS) {
    if (g.patterns.some((re) => re.test(blob))) {
      matchedThemes.push(g.label)
    }
  }

  const themeList = matchedThemes.slice(0, 3).join(', ')
  const firstLine =
    input.userMessages.length > 0 ? trimSnippet(input.userMessages[0] ?? '', 80) : ''
  const snippetClause =
    matchedThemes.length > 0 && firstLine
      ? ` You also wrote: “${firstLine}”`
      : matchedThemes.length > 0 && !firstLine
        ? ''
        : ''

  const thematic =
    matchedThemes.length > 0
      ? fillTemplate(pickVariant(THEMATIC_WITH_THEMES, `${seedBase}:t1`), { themes: themeList }) + snippetClause
      : input.heartCheckIns > 0
        ? pickVariant(THEMATIC_NO_THEMES_HAS_CHECKS, `${seedBase}:t2`)
        : pickVariant(THEMATIC_EMPTY, `${seedBase}:t3`)

  const s = input.heartCheckIns === 1 ? '' : 's'
  const rhythm =
    input.heartCheckIns > 0
      ? fillTemplate(pickVariant(RHYTHM_WITH_CHECKS, `${seedBase}:r1`), {
          n: input.heartCheckIns,
          s,
        })
      : input.streakCount > 0
        ? fillTemplate(pickVariant(RHYTHM_STREAK, `${seedBase}:r2`), {
            streak: input.streakCount,
            s: input.streakCount === 1 ? '' : 's',
          })
        : pickVariant(RHYTHM_START, `${seedBase}:r3`)

  const verseKey = (input.currentVerseKey || '').trim()
  const hasVerseKey = /^\d+:\d+$/.test(verseKey)
  const surahLabel = (input.currentSurahName || '').trim()
  const prompt = hasVerseKey
    ? surahLabel
      ? fillTemplate(pickVariant(PROMPT_WITH_SURAH, `${seedBase}:p1`), {
          surah: surahLabel,
          key: verseKey,
        })
      : fillTemplate(pickVariant(PROMPT_KEY_ONLY, `${seedBase}:p2`), { key: verseKey })
    : pickVariant(PROMPT_NO_KEY, `${seedBase}:p3`)

  return [
    { title: 'Thematic echo', body: thematic, kind: 'themes' },
    { title: 'Session rhythm', body: rhythm, kind: 'rhythm' },
    { title: 'Gentle prompt', body: prompt, kind: 'prompt' },
  ]
}
