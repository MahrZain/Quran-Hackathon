import { ArrowRight, Share2, Search, ChevronDown, Check, X } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isDropdownOpen])

  const meta = fillSurahMeta(ayah)
  const ref = `${meta.surahName} · ${meta.surahId}:${meta.ayahNumber}`
  
  const filteredResources = useMemo(() => {
    if (!searchQuery.trim()) return translationResources
    const q = searchQuery.toLowerCase()
    return translationResources.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.language_name.toLowerCase().includes(q) ||
      (r.author_name?.toLowerCase() || '').includes(q)
    )
  }, [translationResources, searchQuery])

  const groupedTranslations = useMemo(() => groupTranslationsByLanguage(filteredResources), [filteredResources])
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
          <div className="relative w-full min-w-0" ref={dropdownRef}>
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/80">
              Translation edition
            </span>
            
            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              disabled={translationsCatalogLoading}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-outline-variant/25 bg-surface-container-highest/60 px-4 py-2.5 text-left text-xs text-on-surface shadow-sm transition hover:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
            >
              <span className="truncate font-medium">
                {selectedTranslationMeta ? (
                  <>{selectedTranslationMeta.name} <span className="opacity-60">({selectedTranslationMeta.language_name})</span></>
                ) : (
                  'Default (App)'
                )}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 opacity-50 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute right-0 top-full z-[100] mt-2 flex w-full flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-ambient ring-1 ring-black/5 sm:w-[28rem]"
                >
                  <div className="sticky top-0 z-10 border-b border-outline-variant/10 bg-surface-container-lowest/90 px-4 py-3 backdrop-blur-sm">
                    <div className="relative flex items-center">
                      <Search className="absolute left-3 h-3.5 w-3.5 opacity-40" />
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search translations…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg bg-surface-container-low px-9 py-2 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/10"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 rounded-full p-0.5 hover:bg-surface-container-high"
                        >
                          <X className="h-3 w-3 opacity-50" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto overscroll-contain py-2 custom-scrollbar">
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardTranslationResourceId(null)
                        setIsDropdownOpen(false)
                      }}
                      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition hover:bg-primary/5 ${
                        dashboardTranslationResourceId === null ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'
                      }`}
                    >
                      <span>Default (App Selection)</span>
                      {dashboardTranslationResourceId === null && <Check className="h-3.5 w-3.5" />}
                    </button>

                    {[...groupedTranslations.entries()].map(([langLabel, rows]) => (
                      <div key={langLabel}>
                        <div className="bg-surface-container-low/50 px-4 py-1.5 text-[9px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                          {langLabel}
                        </div>
                        {rows.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => {
                              setDashboardTranslationResourceId(r.id)
                              setIsDropdownOpen(false)
                            }}
                            className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-xs transition hover:bg-primary/5 ${
                              dashboardTranslationResourceId === r.id ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface'
                            }`}
                          >
                            <div className="min-w-0 pr-4">
                              <div className="truncate">{r.name}</div>
                              {r.author_name && (
                                <div className="truncate text-[10px] opacity-60 font-normal">{r.author_name}</div>
                              )}
                            </div>
                            {dashboardTranslationResourceId === r.id && <Check className="h-3.5 w-3.5 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    ))}
                    
                    {[...groupedTranslations.entries()].length === 0 && (
                      <div className="px-4 py-8 text-center text-xs text-on-surface-variant/60">
                        No translations found matching your search.
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
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
                  setPlayErr('Audio is not available for this verse right now.')
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
        </div>
      </div>
    </div>
  )
}
