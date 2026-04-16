import { ArrowRight, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMoodAyah, type VerseEnrichmentStatus } from '../context/MoodAyahContext'
import type { TranslationResourceOut } from '../lib/apiTypes'
import { QuranAyahText } from './QuranAyahText'
import { useSound } from '../hooks/useSound'
import { fillSurahMeta, isAyahArabicPlaceholder, type DailyAyah } from '../lib/mockData'
import { shareVerse } from '../lib/shareVerse'

type DailyAyahBlockProps = {
  ayah: DailyAyah
  className?: string
}

type TextMode = 'arabic' | 'translation'

function groupTranslationsByLanguage(items: TranslationResourceOut[]): Map<string, TranslationResourceOut[]> {
  const m = new Map<string, TranslationResourceOut[]>()
  for (const row of items) {
    const label = row.language_name.trim() || 'Other'
    const list = m.get(label) ?? []
    list.push(row)
    m.set(label, list)
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  }
  return new Map([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

/** BCP 47-ish hint from API `language_name` (best-effort for `lang` / `dir`). */
function translationParagraphLang(languageName: string): string | undefined {
  const low = languageName.toLowerCase()
  const pairs: [RegExp, string][] = [
    [/urdu/, 'ur'],
    [/arabic/, 'ar'],
    [/english/, 'en'],
    [/french/, 'fr'],
    [/spanish/, 'es'],
    [/german/, 'de'],
    [/turkish/, 'tr'],
    [/indonesian/, 'id'],
    [/bengali/, 'bn'],
    [/russian/, 'ru'],
    [/persian|farsi/, 'fa'],
    [/malay/, 'ms'],
    [/portuguese/, 'pt'],
    [/italian/, 'it'],
    [/dutch/, 'nl'],
    [/hindi/, 'hi'],
    [/tamil/, 'ta'],
    [/chinese/, 'zh'],
    [/japanese/, 'ja'],
    [/korean/, 'ko'],
  ]
  for (const [re, code] of pairs) {
    if (re.test(low)) return code
  }
  return undefined
}

function translationParagraphDir(languageName: string): 'rtl' | 'ltr' {
  const low = languageName.toLowerCase()
  if (
    /arabic|urdu|hebrew|farsi|persian|pashto|sindhi|uyghur|divehi|dhivehi/.test(low)
  ) {
    return 'rtl'
  }
  return 'ltr'
}

function ArabicPlaceholderBlock({
  status,
  flexFill,
  compact,
}: {
  status: VerseEnrichmentStatus
  flexFill?: boolean
  compact?: boolean
}) {
  const busy = status === 'pending' || status === 'text_ready'
  const height = flexFill ? 'min-h-[12rem] flex-1' : compact ? 'min-h-[6rem]' : 'min-h-[10rem]'
  return (
    <div
      className={`mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 ${height}`}
      dir="rtl"
      lang="ar"
      aria-busy={busy}
      aria-label={status === 'unavailable' ? 'Arabic text unavailable' : 'Loading Arabic ayah'}
    >
      <div className={`w-full space-y-2.5 ${compact ? 'max-w-md' : 'max-w-lg'}`}>
        <div className="ms-auto h-2.5 w-[88%] animate-pulse rounded-full bg-primary/12" />
        <div className="ms-auto h-2.5 w-[72%] animate-pulse rounded-full bg-primary/12" />
        <div className="ms-auto h-2.5 w-[80%] animate-pulse rounded-full bg-primary/12" />
      </div>
      <p className="text-center font-serif text-xs text-on-surface-variant/90" dir="ltr">
        {status === 'unavailable' ? 'Arabic text could not be loaded. Try again later.' : 'Loading ayah…'}
      </p>
    </div>
  )
}

export function DailyAyahBlock({ ayah, className = '' }: DailyAyahBlockProps) {
  const {
    verseEnrichmentStatus,
    dashboardTranslationResourceId,
    setDashboardTranslationResourceId,
    translationResources,
    translationsCatalogLoading,
    translationsCatalogError,
  } = useMoodAyah()
  const { playRecitation } = useSound()
  const [textMode, setTextMode] = useState<TextMode>('arabic')
  const [audioBusy, setAudioBusy] = useState(false)
  const [playErr, setPlayErr] = useState<string | null>(null)

  const meta = fillSurahMeta(ayah)
  const ref = `${meta.surahName} · ${meta.surahId}:${meta.ayahNumber}`
  const groupedTranslations = groupTranslationsByLanguage(translationResources)
  const selectedTranslationMeta = translationResources.find((r) => r.id === dashboardTranslationResourceId)
  const translationLang = selectedTranslationMeta
    ? translationParagraphLang(selectedTranslationMeta.language_name)
    : undefined
  const translationDir = selectedTranslationMeta
    ? translationParagraphDir(selectedTranslationMeta.language_name)
    : 'ltr'
  const focusHref = `/focus?surah=${ayah.surahId}&ayah=${ayah.ayahNumber}`
  const readerHref = `/quran/${ayah.surahId}?ayah=${ayah.ayahNumber}`

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-xs font-bold transition ${
      active
        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
        : 'text-on-surface-variant hover:bg-surface-container-high/60'
    }`

  const arabicPending = isAyahArabicPlaceholder(ayah.arabic)

  return (
    <div className={`asar-glass relative flex h-full min-h-0 flex-col overflow-hidden rounded-stitch p-6 sm:p-8 ${className}`}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex w-fit rounded-full bg-primary-container/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-primary-fixed-variant">
          {ref}
        </span>
        <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:max-w-md sm:items-end">
          <div className="flex items-center gap-2 self-start rounded-full bg-surface-container p-1 sm:self-end" role="tablist" aria-label="Verse text">
            <button
              type="button"
              role="tab"
              aria-selected={textMode === 'arabic'}
              className={tabClass(textMode === 'arabic')}
              onClick={() => setTextMode('arabic')}
            >
              Arabic
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={textMode === 'translation'}
              className={tabClass(textMode === 'translation')}
              onClick={() => setTextMode('translation')}
            >
              Translation
            </button>
          </div>
          <div className="w-full min-w-0">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant/80">
                Translation edition
              </span>
              <select
                value={dashboardTranslationResourceId ?? ''}
                onChange={(e) => {
                  const raw = e.target.value
                  if (raw === '') {
                    setDashboardTranslationResourceId(null)
                    return
                  }
                  const n = parseInt(raw, 10)
                  setDashboardTranslationResourceId(Number.isFinite(n) && n >= 1 ? n : null)
                }}
                disabled={translationsCatalogLoading}
                className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-highest/60 px-3 py-2 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim disabled:opacity-60"
                aria-busy={translationsCatalogLoading}
              >
                <option value="">Default (app)</option>
                {[...groupedTranslations.entries()].map(([langLabel, rows]) => (
                  <optgroup key={langLabel} label={langLabel}>
                    {rows.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                        {r.author_name ? ` — ${r.author_name}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            {translationsCatalogError ? (
              <p className="mt-1 text-[10px] text-error">Could not load translation list. Using default only.</p>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        {textMode === 'arabic' ? (
          <>
            {arabicPending ? (
              <ArabicPlaceholderBlock status={verseEnrichmentStatus} flexFill />
            ) : (
              <QuranAyahText text={ayah.arabic} flexFill className="mx-auto w-full justify-center" />
            )}
            <p
              className="max-w-md shrink-0 font-serif text-sm italic text-on-surface/55 sm:text-base"
              dir={translationDir}
              {...(translationLang ? { lang: translationLang } : {})}
            >
              &ldquo;{ayah.translation}&rdquo;
            </p>
          </>
        ) : (
          <>
            {arabicPending ? (
              <ArabicPlaceholderBlock status={verseEnrichmentStatus} compact />
            ) : (
              <QuranAyahText
                text={ayah.arabic}
                className="mx-auto max-w-2xl justify-center text-lg opacity-80 sm:text-xl"
              />
            )}
            <p
              className="max-w-lg shrink-0 font-serif text-base leading-relaxed text-on-surface/90 sm:text-lg"
              dir={translationDir}
              {...(translationLang ? { lang: translationLang } : {})}
            >
              &ldquo;{ayah.translation}&rdquo;
            </p>
          </>
        )}
      </div>
      <div
        className={`mt-6 flex flex-col gap-4 border-t border-outline-variant/20 pt-6 transition-opacity duration-500 sm:mt-8 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between ${
          verseEnrichmentStatus === 'pending' || verseEnrichmentStatus === 'text_ready' ? 'opacity-90' : 'opacity-100'
        }`}
        aria-busy={verseEnrichmentStatus === 'pending' || verseEnrichmentStatus === 'text_ready'}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary" aria-hidden>
              electric_bolt
            </span>
            <span className="text-sm font-bold tracking-tight text-primary">AI-Reflection Ready</span>
          </div>
          {verseEnrichmentStatus === 'pending' ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
              Syncing ayah &amp; audio in background…
            </span>
          ) : verseEnrichmentStatus === 'text_ready' ? (
            <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant/70">
              Loading translation &amp; audio…
            </span>
          ) : verseEnrichmentStatus === 'unavailable' ? (
            <span className="text-[10px] font-medium text-on-surface-variant/70">Using offline ayah text</span>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <button
            type="button"
            onClick={() =>
              void shareVerse({
                arabic: ayah.arabic,
                reference: ref,
                translation: ayah.translation,
                url: `${window.location.origin}${readerHref}`,
              })
            }
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary"
          >
            <Share2 className="h-4 w-4 shrink-0" aria-hidden />
            Share
          </button>
          <button
            type="button"
            disabled={audioBusy}
            onClick={() => {
              setPlayErr(null)
              setAudioBusy(true)
              void (async () => {
                const result = await playRecitation({
                  surahId: ayah.surahId,
                  ayahNumber: ayah.ayahNumber,
                  audioUrl: ayah.audioUrl,
                })
                setAudioBusy(false)
                if (result === 'no_url') {
                  setPlayErr('No audio URL for this verse. Is the ASAR API running?')
                } else if (result === 'blocked') {
                  setPlayErr('Playback was blocked — try tapping Play again, or check the browser audio permission.')
                }
              })()
            }}
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary disabled:opacity-55"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              play_circle
            </span>
            {audioBusy ? 'Loading…' : 'Play Recitation'}
          </button>
          {playErr ? <p className="w-full text-xs text-error sm:w-auto">{playErr}</p> : null}
          <Link
            prefetch="viewport"
            to={focusHref}
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              center_focus_strong
            </span>
            Focus — Ayah reflection
          </Link>
          <Link
            prefetch="viewport"
            to={readerHref}
            className="text-sm font-bold text-primary/70 hover:text-primary hover:underline"
          >
            Open in reader
          </Link>
          <Link
            prefetch="viewport"
            to="/insights"
            aria-label="Open AI insight results page for this session and spotlight verse"
            className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-primary transition hover:border-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="material-symbols-outlined text-base text-secondary" aria-hidden>
              auto_awesome
            </span>
            AI insights
            <ArrowRight className="h-4 w-4 opacity-70" aria-hidden />
          </Link>
        </div>
        <p className="text-[10px] leading-snug text-on-surface-variant/75">
          Opens the insights page (session themes, streak rhythm, verse prompt)—not an on-card timer.
        </p>
        </div>
      </div>
    </div>
  )
}
