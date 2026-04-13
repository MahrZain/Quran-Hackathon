import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMoodAyah } from '../context/MoodAyahContext'
import { QuranAyahText } from './QuranAyahText'
import { useSound } from '../hooks/useSound'
import { fillSurahMeta, type DailyAyah } from '../lib/mockData'

type DailyAyahBlockProps = {
  ayah: DailyAyah
  className?: string
}

type TextMode = 'arabic' | 'translation'

export function DailyAyahBlock({ ayah, className = '' }: DailyAyahBlockProps) {
  const { verseEnrichmentStatus } = useMoodAyah()
  const { playRecitation } = useSound()
  const [textMode, setTextMode] = useState<TextMode>('arabic')
  const [audioBusy, setAudioBusy] = useState(false)
  const [playErr, setPlayErr] = useState<string | null>(null)

  const meta = fillSurahMeta(ayah)
  const ref = `${meta.surahName} · ${meta.surahId}:${meta.ayahNumber}`
  const focusHref = `/focus?surah=${ayah.surahId}&ayah=${ayah.ayahNumber}`
  const readerHref = `/quran/${ayah.surahId}?ayah=${ayah.ayahNumber}`

  const tabClass = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-xs font-bold transition ${
      active
        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
        : 'text-on-surface-variant hover:bg-surface-container-high/60'
    }`

  return (
    <div className={`asar-glass relative flex h-full min-h-0 flex-col overflow-hidden rounded-stitch p-6 sm:p-8 ${className}`}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex w-fit rounded-full bg-primary-container/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-primary-fixed-variant">
          {ref}
        </span>
        <div className="flex items-center gap-2 rounded-full bg-surface-container p-1" role="tablist" aria-label="Verse text">
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
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        {textMode === 'arabic' ? (
          <>
            <QuranAyahText text={ayah.arabic} flexFill className="mx-auto w-full justify-center" />
            <p className="max-w-md shrink-0 font-serif text-sm italic text-on-surface/55 sm:text-base">
              &ldquo;{ayah.translation}&rdquo;
            </p>
          </>
        ) : (
          <>
            <QuranAyahText
              text={ayah.arabic}
              className="mx-auto max-w-2xl justify-center text-lg opacity-80 sm:text-xl"
            />
            <p className="max-w-lg shrink-0 font-serif text-base leading-relaxed text-on-surface/90 sm:text-lg">
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
