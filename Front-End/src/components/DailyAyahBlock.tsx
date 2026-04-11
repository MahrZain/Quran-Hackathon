import { Link } from 'react-router-dom'
import { QuranAyahText } from './QuranAyahText'
import { useSound } from '../hooks/useSound'
import type { DailyAyah } from '../lib/mockData'

type DailyAyahBlockProps = {
  ayah: DailyAyah
  className?: string
}

export function DailyAyahBlock({ ayah, className = '' }: DailyAyahBlockProps) {
  const { playRecitation } = useSound()
  const ref = `${ayah.surahName} • ${ayah.surahId}:${ayah.ayahNumber}`

  return (
    <div className={`asar-glass relative flex h-full min-h-0 flex-col overflow-hidden rounded-stitch p-6 sm:p-8 ${className}`}>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <span className="inline-flex w-fit rounded-full bg-primary-container/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-on-primary-fixed-variant">
          {ref}
        </span>
        <div className="flex items-center gap-2 rounded-full bg-surface-container p-1">
          <button
            type="button"
            className="rounded-full bg-surface-container-lowest px-4 py-1.5 text-xs font-bold text-on-surface shadow-sm"
          >
            Arabic
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-on-surface-variant"
          >
            Translation
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 text-center">
        <QuranAyahText text={ayah.arabic} flexFill className="mx-auto w-full justify-center" />
        <p className="max-w-md shrink-0 font-serif text-base italic text-on-surface/70 sm:text-lg">
          &ldquo;{ayah.translation}&rdquo;
        </p>
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
            onClick={() => playRecitation({ surahId: ayah.surahId, ayahNumber: ayah.ayahNumber })}
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              play_circle
            </span>
            Play Recitation
          </button>
          <Link
            to="/focus"
            className="flex items-center gap-2 text-sm font-bold text-primary/80 hover:text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-base" aria-hidden>
              center_focus_strong
            </span>
            Focus — Ayah reflection
          </Link>
          <Link
            to={`/quran/${ayah.surahId}`}
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
