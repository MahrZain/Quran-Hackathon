import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { QuranAyahText } from '../components/QuranAyahText'
import { useMoodAyah } from '../context/MoodAyahContext'
import { apiClient } from '../lib/apiClient'
import type { VerseBundleResponse } from '../lib/apiTypes'

export function FocusPage() {
  const [sp] = useSearchParams()
  const { displayAyah } = useMoodAyah()

  const verseKey = useMemo(() => {
    const s = sp.get('surah')
    const a = sp.get('ayah')
    if (s && a && /^\d+$/.test(s) && /^\d+$/.test(a)) return `${s}:${a}`
    return `${displayAyah.surahId}:${displayAyah.ayahNumber}`
  }, [sp, displayAyah.surahId, displayAyah.ayahNumber])

  const [bundle, setBundle] = useState<VerseBundleResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    void apiClient
      .get<VerseBundleResponse>('/verse', { params: { verse_key: verseKey } })
      .then(({ data }) => {
        if (!cancelled) setBundle(data)
      })
      .catch(() => {
        if (!cancelled) {
          setErr('Could not load this verse from the API. Check the ASAR Engine and Quran OAuth in Back-End/.env.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [verseKey])

  const arabic = bundle?.verse_text_uthmani?.trim() || displayAyah.arabic
  const translation = bundle?.verse_translation?.trim() || displayAyah.translation

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center px-4">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
        Focus mode · {verseKey}
      </p>
      <div className="rounded-bento bg-surface-container-lowest/90 p-8 shadow-ambient sm:p-12">
        {loading ? (
          <p className="text-center text-sm text-on-surface/60">Loading verse…</p>
        ) : err ? (
          <p className="text-center text-sm text-error">{err}</p>
        ) : (
          <>
            <QuranAyahText text={arabic} className="mx-auto" />
            <p className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-on-surface/75">
              {translation}
            </p>
          </>
        )}
      </div>
      <p className="mt-8 text-center text-xs text-on-surface/45">
        Opened from the dashboard with your current āyah, or from a link with <code className="text-on-surface/55">?surah=&amp;ayah=</code>
        .
      </p>
    </div>
  )
}
