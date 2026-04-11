import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { QuranAyahText } from '../components/QuranAyahText'
import { SAMPLE_AYAH, SAMPLE_TRANSLATION, SURAH_LIST } from '../lib/mockData'

export function ReaderPage() {
  const { surahId } = useParams()
  const id = Number(surahId)
  const surah = SURAH_LIST.find((s) => s.id === id)

  return (
    <div className="mx-auto max-w-xl">
      <Link
        to="/quran"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-secondary hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Surah list
      </Link>

      <article className="rounded-bento bg-surface-container-low p-6 shadow-ambient sm:p-8">
        <header className="mb-8 border-b border-outline-variant/15 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-secondary">
            {surah ? `Surah ${surah.id}` : 'Reader'}
          </p>
          <h1
            className="quran-mushaf mt-1 text-2xl leading-relaxed text-primary"
            dir="rtl"
            lang="ar"
          >
            {surah?.name ?? 'القرآن'}
          </h1>
          {surah ? (
            <p className="text-sm text-on-surface/65">{surah.transliteration}</p>
          ) : null}
        </header>

        <div className="mb-6 w-full">
          <QuranAyahText text={SAMPLE_AYAH} fullWidth className="mx-auto" />
        </div>
        <p className="text-sm italic leading-relaxed text-on-surface/75">{SAMPLE_TRANSLATION}</p>

        <footer className="mt-10 flex justify-between text-xs text-on-surface/45">
          <span>āyah 56 · sample</span>
          <span>Swipe / keys — wire navigation later</span>
        </footer>
      </article>
    </div>
  )
}
