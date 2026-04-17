import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiClient } from '../lib/apiClient'
import type { ChapterSummary } from '../lib/apiTypes'
import { SURAH_LIST } from '../lib/mockData'

const LAST_READ_KEY = 'asar_last_read'

type LastRead = { surah: number; ayah: number }

function readLastRead(): LastRead | null {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as unknown
    if (
      o &&
      typeof o === 'object' &&
      'surah' in o &&
      'ayah' in o &&
      typeof (o as LastRead).surah === 'number' &&
      typeof (o as LastRead).ayah === 'number'
    ) {
      return o as LastRead
    }
  } catch {
    /* ignore */
  }
  return null
}

export function QuranListPage() {
  const [q, setQ] = useState('')
  const [chapters, setChapters] = useState<ChapterSummary[] | null>(null)
  const [listErr, setListErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resume, setResume] = useState<LastRead | null>(null)

  useEffect(() => {
    setResume(readLastRead())
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setListErr(null)
    void apiClient
      .get<ChapterSummary[]>('/chapters')
      .then(({ data }) => {
        if (!cancelled) setChapters(data.length ? data : null)
      })
      .catch(() => {
        if (!cancelled) {
          setListErr('Could not load the full surah list from the API. Showing a short offline sample.')
          setChapters(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const list = chapters ?? SURAH_LIST.map((s) => ({
    id: s.id,
    name: s.name,
    transliteration: s.transliteration,
    verses: s.verses,
    revelation: s.revelation,
  }))

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return list
    return list.filter(
      (s) =>
        s.transliteration.toLowerCase().includes(needle) ||
        s.name.includes(needle) ||
        String(s.id).includes(needle),
    )
  }, [list, q])

  return (
    <div className="mx-auto max-w-3xl px-4">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">Quran progress</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          All 114 surahs. Search by name, Arabic, or surah number.
        </p>
        {listErr && <p className="mt-2 text-xs text-error">{listErr}</p>}
        {resume && resume.surah >= 1 && resume.surah <= 114 ? (
          <Link
            to={`/quran/${resume.surah}?ayah=${resume.ayah}`}
            className="mt-4 inline-flex rounded-full border border-primary/35 bg-primary-container/15 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-container/25"
          >
            Continue reading · Surah {resume.surah}, āyah {resume.ayah}
          </Link>
        ) : null}
      </header>

      <label className="mb-6 flex items-center gap-3 rounded-bento bg-surface-container-low px-4 py-3 shadow-ambient">
        <Search className="h-5 w-5 shrink-0 text-on-surface/40" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search surah…"
          className="min-w-0 flex-1 border-0 bg-transparent text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:ring-0"
          type="search"
          autoComplete="off"
          disabled={loading && !chapters}
        />
      </label>

      {loading && !chapters ? (
        <p className="text-sm text-on-surface/60">Loading surah list…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((s) => (
            <li key={s.id}>
              <Link
                to={`/quran/${s.id}?ayah=1`}
                className="flex items-center justify-between gap-4 rounded-bento bg-surface-container-low px-5 py-4 shadow-ambient transition hover:bg-surface-container-highest hover:shadow-glass"
              >
                <div className="min-w-0">
                  <p className="font-serif text-lg text-on-surface" dir="rtl" lang="ar">
                    {s.name}
                  </p>
                  <p className="text-sm text-on-surface/60">{s.transliteration}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-on-surface/50">
                  <span className="block font-medium text-secondary">{s.id}</span>
                  <span>
                    {s.verses} āyāt · {s.revelation}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
