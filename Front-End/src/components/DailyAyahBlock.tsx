import { useState } from 'react'
import { Link } from 'react-router-dom'
import { QuranAyahText } from './QuranAyahText'
import { useSound } from '../hooks/useSound'
import type { DailyAyah } from '../lib/mockData'

type DailyAyahBlockProps = {
  ayah: DailyAyah
  className?: string
}

type TextMode = 'arabic' | 'translation'

export function DailyAyahBlock({ ayah, className = '' }: DailyAyahBlockProps) {
  const { playRecitation } = useSound()
  const [textMode, setTextMode] = useState<TextMode>('arabic')
  const [audioBusy, setAudioBusy] = useState(false)
  const [playErr, setPlayErr] = useState<string | null>(null)

  const ref = `${ayah.surahName} • ${ayah.surahId}:${ayah.ayahNumber}`
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
      <div className="mt-6 flex flex-col gap-4 border-t border-outline-variant/20 pt-6 sm:mt-8 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary" aria-hidden>
            electric_bolt
          </span>
          <span className="text-sm font-bold tracking-tight text-primary">AI-Reflection Ready</span>
        </div>
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
            to={focusHref}
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              center_focus_strong
            </span>
            Focus — Ayah reflection
          </Link>
          <Link
            to={readerHref}
            className="text-sm font-bold text-primary/70 hover:text-primary hover:underline"
          >
            Open in reader
          </Link>
          <Link
            to="/insights"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary shadow-[0_0_22px_rgba(212,175,55,0.45)] ring-2 ring-accent-gold/35 transition hover:shadow-[0_0_28px_rgba(212,175,55,0.55)] hover:ring-accent-gold/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            19-sec Summary
            <span className="material-symbols-outlined text-base" aria-hidden>
              auto_awesome
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
