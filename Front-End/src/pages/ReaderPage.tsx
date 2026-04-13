import { ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { QuranAyahText } from '../components/QuranAyahText'
import { apiClient } from '../lib/apiClient'
import type { ChapterSummary, VerseBundleResponse } from '../lib/apiTypes'
import { addBookmark, hasBookmark, removeBookmark } from '../lib/bookmarks'
import { fetchVerseBundleDeduped } from '../lib/engineDataCache'

const LAST_READ_KEY = 'asar_last_read'

function saveLastRead(surah: number, ayah: number) {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify({ surah, ayah }))
  } catch {
    /* ignore */
  }
}

export function ReaderPage() {
  const { surahId } = useParams()
  const [sp] = useSearchParams()
  const navigate = useNavigate()
  const id = Number(surahId)

  const ayahFromUrl = useMemo(() => {
    const raw = sp.get('ayah')
    const n = raw ? Number(raw) : 1
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1
  }, [sp])

  const [chapterMeta, setChapterMeta] = useState<ChapterSummary | null>(null)
  const [chapterErr, setChapterErr] = useState<string | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id) || id < 1 || id > 114) {
      setChapterMeta(null)
      setChapterErr(null)
      return
    }
    let cancelled = false
    setChapterErr(null)
    void apiClient
      .get<ChapterSummary>(`/chapters/${id}`)
      .then(({ data }) => {
        if (!cancelled) setChapterMeta(data)
      })
      .catch(() => {
        if (!cancelled) {
          setChapterMeta(null)
          setChapterErr('Could not load surah title from the API.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const ayahClamped = useMemo(() => {
    const lo = 1
    const hi = chapterMeta?.verses ?? 999
    return Math.min(Math.max(lo, ayahFromUrl), hi)
  }, [ayahFromUrl, chapterMeta])

  useEffect(() => {
    if (!chapterMeta) return
    if (ayahFromUrl > chapterMeta.verses) {
      navigate(`/quran/${id}?ayah=${chapterMeta.verses}`, { replace: true })
    }
  }, [chapterMeta, ayahFromUrl, id, navigate])

  const verseKey = Number.isFinite(id) && id >= 1 && id <= 114 ? `${id}:${ayahClamped}` : null

  const [bundle, setBundle] = useState<VerseBundleResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!verseKey) {
      setBundle(null)
      setErr(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setErr(null)
    void fetchVerseBundleDeduped(verseKey)
      .then((data) => {
        if (!cancelled) setBundle(data)
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load this āyah. Check that the ASAR Engine is running and Quran API settings are valid.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [verseKey])

  const arabic = bundle?.verse_text_uthmani?.trim() || ''
  const translation = bundle?.verse_translation?.trim() || ''

  useEffect(() => {
    if (!verseKey || (!arabic && !translation)) return
    const parts = verseKey.split(':')
    const s = Number(parts[0])
    const a = Number(parts[1])
    if (Number.isFinite(s) && Number.isFinite(a)) saveLastRead(s, a)
  }, [arabic, translation, verseKey])

  const hasText = Boolean(arabic || translation)
  const prevAyah = ayahClamped > 1 ? ayahClamped - 1 : null
  const nextAyah =
    chapterMeta && ayahClamped < chapterMeta.verses ? ayahClamped + 1 : null

  const invalidSurah = !Number.isFinite(id) || id < 1 || id > 114

  const [bookmarked, setBookmarked] = useState(false)
  useEffect(() => {
    if (invalidSurah) return
    setBookmarked(hasBookmark(id, ayahClamped))
  }, [id, ayahClamped, invalidSurah])

  const toggleBookmark = () => {
    if (invalidSurah) return
    if (hasBookmark(id, ayahClamped)) {
      removeBookmark(id, ayahClamped)
      setBookmarked(false)
    } else {
      addBookmark({ surah: id, ayah: ayahClamped })
      setBookmarked(true)
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4">
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
            {invalidSurah ? 'Reader' : `Surah ${id}`}
          </p>
          <h1 className="quran-mushaf mt-1 text-2xl leading-relaxed text-primary" dir="rtl" lang="ar">
            {chapterMeta?.name ?? (invalidSurah ? 'القرآن' : '…')}
          </h1>
          {chapterMeta ? (
            <p className="text-sm text-on-surface/65">{chapterMeta.transliteration}</p>
          ) : chapterErr ? (
            <p className="text-sm text-on-surface-variant">{chapterErr}</p>
          ) : !invalidSurah ? (
            <p className="text-sm text-on-surface/50">Loading surah…</p>
          ) : null}
        </header>

        {invalidSurah ? (
          <p className="text-sm text-on-surface/70">
            Open a surah between <strong>1</strong> and <strong>114</strong> from the Quran progress tab.
          </p>
        ) : loading ? (
          <p className="text-sm text-on-surface/60">Loading āyah {ayahClamped}…</p>
        ) : err ? (
          <p className="text-sm text-error">{err}</p>
        ) : verseKey && hasText ? (
          <>
            {arabic ? (
              <div className="mb-6 w-full">
                <QuranAyahText text={arabic} fullWidth className="mx-auto" />
              </div>
            ) : null}
            {translation ? (
              <p className="text-sm italic leading-relaxed text-on-surface/75">{translation}</p>
            ) : null}
          </>
        ) : (
          <div className="space-y-2 text-sm text-on-surface/70">
            <p>
              No text returned for <strong>{verseKey}</strong>. The verse endpoint responded but Uthmani /
              translation fields were empty (often a Quran API / OAuth issue).
            </p>
            <p className="text-xs text-on-surface/55">
              Tip: use <code className="text-on-surface/60">?ayah=</code> in the URL to open a specific āyah, e.g.{' '}
              <code className="text-on-surface/60">/quran/57?ayah=4</code>.
            </p>
          </div>
        )}

        {!invalidSurah && (
          <nav className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/15 pt-6 text-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleBookmark()}
                className={`rounded-full border px-4 py-2 font-medium transition ${
                  bookmarked
                    ? 'border-secondary bg-secondary/15 text-secondary'
                    : 'border-outline-variant/30 text-primary hover:bg-surface-container-high'
                }`}
              >
                {bookmarked ? 'Bookmarked' : 'Bookmark'}
              </button>
              {prevAyah !== null ? (
                <Link
                  to={`/quran/${id}?ayah=${prevAyah}`}
                  className="rounded-full border border-outline-variant/30 px-4 py-2 font-medium text-primary hover:bg-surface-container-high"
                >
                  ← Previous āyah
                </Link>
              ) : (
                <span className="rounded-full px-4 py-2 text-on-surface/35">← Start of surah</span>
              )}
              {nextAyah !== null ? (
                <Link
                  to={`/quran/${id}?ayah=${nextAyah}`}
                  className="rounded-full border border-outline-variant/30 px-4 py-2 font-medium text-primary hover:bg-surface-container-high"
                >
                  Next āyah →
                </Link>
              ) : chapterMeta ? (
                <Link
                  to={id < 114 ? `/quran/${id + 1}?ayah=1` : '/quran'}
                  className="rounded-full border border-primary/30 bg-primary-container/10 px-4 py-2 font-medium text-primary hover:bg-primary-container/20"
                >
                  {id < 114 ? `Next surah (${id + 1})` : 'Back to list'}
                </Link>
              ) : null}
            </div>
            <span className="text-xs text-on-surface/45">
              {verseKey ? `${verseKey}` : ''}
              {chapterMeta ? ` · ${chapterMeta.verses} āyāt` : ''}
            </span>
          </nav>
        )}
      </article>
    </div>
  )
}
