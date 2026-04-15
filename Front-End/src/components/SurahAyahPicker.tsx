import { useMemo, useState } from 'react'
import type { ChapterSummary } from '../lib/apiTypes'

export type SurahAyahPickerProps = {
  chapters: ChapterSummary[] | null
  /** Selected surah id (1–114) */
  surahId: number | null
  onSurahChange: (id: number | null) => void
  /** When true, show āyah step after surah */
  showAyah?: boolean
  ayahNumber?: number
  onAyahChange?: (n: number) => void
  /** Lock surah (e.g. custom start inside chosen scope surah) */
  lockSurahId?: number | null
  surahLabel?: string
  errorHint?: string | null
}

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export function SurahAyahPicker({
  chapters,
  surahId,
  onSurahChange,
  showAyah = false,
  ayahNumber = 1,
  onAyahChange,
  lockSurahId = null,
  surahLabel = 'Surah',
  errorHint,
}: SurahAyahPickerProps) {
  const [query, setQuery] = useState('')

  const lockedChapter = useMemo(() => {
    if (lockSurahId == null || !chapters?.length) return null
    return chapters.find((c) => c.id === lockSurahId) ?? null
  }, [chapters, lockSurahId])

  const selectedChapter = useMemo(() => {
    if (surahId == null || !chapters?.length) return null
    return chapters.find((c) => c.id === surahId) ?? null
  }, [chapters, surahId])

  const filtered = useMemo(() => {
    if (!chapters?.length) return []
    if (lockSurahId != null) return chapters.filter((c) => c.id === lockSurahId)
    const q = normalize(query)
    if (!q) return chapters.slice(0, 24)
    return chapters.filter((c) => {
      const idStr = String(c.id)
      const tr = normalize(c.transliteration || '')
      const name = normalize(c.name || '')
      return idStr.includes(q) || tr.includes(q) || name.includes(q)
    })
  }, [chapters, query, lockSurahId])

  const maxAyah = selectedChapter?.verses && selectedChapter.verses > 0 ? selectedChapter.verses : 286
  const ayahClamped = Math.min(Math.max(1, ayahNumber || 1), maxAyah)

  if (lockSurahId != null && !lockedChapter) {
    return (
      <div className="mt-2 rounded-xl border border-outline-variant/20 bg-surface-container-low/60 px-4 py-3 text-sm text-on-surface-variant">
        {chapters == null && !errorHint ? (
          <p>Loading surah list…</p>
        ) : errorHint ? (
          <p>{errorHint}</p>
        ) : (
          <p>
            Could not load details for surah #{lockSurahId}. Try again, or go back and reselect the surah.
          </p>
        )}
      </div>
    )
  }

  if (lockSurahId != null && lockedChapter) {
    return (
      <div className="mt-2 space-y-4">
        <div className="rounded-xl border border-outline-variant/20 bg-surface-container-low/60 px-4 py-3 text-sm text-on-surface">
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">{surahLabel}</span>
          <p className="mt-1 font-semibold">
            {lockedChapter.id}. {lockedChapter.transliteration || lockedChapter.name}
          </p>
          <p className="mt-0.5 text-xs text-on-surface-variant" dir="rtl" lang="ar">
            {lockedChapter.name}
          </p>
        </div>
        {showAyah && onAyahChange && (
          <AyahStep
            maxAyah={lockedChapter.verses || maxAyah}
            ayahClamped={Math.min(Math.max(1, ayahNumber || 1), lockedChapter.verses || maxAyah)}
            onAyahChange={onAyahChange}
          />
        )}
      </div>
    )
  }

  return (
    <div className="mt-2 space-y-3">
      <div>
        <label htmlFor="surah-search" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {surahLabel}
        </label>
        <input
          id="surah-search"
          type="search"
          autoComplete="off"
          placeholder="Search by name (e.g. Yā Sīn) or number…"
          className="mt-2 w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div
        className="max-h-48 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container-low/40 p-1"
        role="listbox"
        aria-label="Surah list"
      >
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-on-surface-variant">No matches. Try another spelling or surah number.</p>
        ) : (
          filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={surahId === c.id}
              onClick={() => {
                onSurahChange(c.id)
                setQuery('')
              }}
              className={`flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left text-sm transition ${
                surahId === c.id ? 'bg-primary/15 font-semibold text-primary' : 'hover:bg-surface-container-high/70'
              }`}
            >
              <span>
                {c.id}. {c.transliteration || `Surah ${c.id}`}
              </span>
              {c.name ? (
                <span className="text-xs text-on-surface-variant" dir="rtl" lang="ar">
                  {c.name}
                </span>
              ) : null}
            </button>
          ))
        )}
      </div>
      {showAyah && surahId != null && onAyahChange && selectedChapter && (
        <AyahStep maxAyah={maxAyah} ayahClamped={ayahClamped} onAyahChange={onAyahChange} />
      )}
      {errorHint && <p className="text-xs text-on-surface-variant">{errorHint}</p>}
    </div>
  )
}

function AyahStep({
  maxAyah,
  ayahClamped,
  onAyahChange,
}: {
  maxAyah: number
  ayahClamped: number
  onAyahChange: (n: number) => void
}) {
  const mid = Math.max(1, Math.ceil(maxAyah / 2))
  return (
    <div className="space-y-2">
      <label htmlFor="ayah-num" className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        Āyah (this surah has {maxAyah})
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-surface-container-high"
          onClick={() => onAyahChange(1)}
        >
          Start (1)
        </button>
        {maxAyah > 2 && (
          <button
            type="button"
            className="rounded-full border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-secondary hover:bg-surface-container-high"
            onClick={() => onAyahChange(mid)}
          >
            Middle (~{mid})
          </button>
        )}
      </div>
      <input
        id="ayah-num"
        type="number"
        min={1}
        max={maxAyah}
        className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm"
        value={ayahClamped}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (!Number.isFinite(n)) return
          onAyahChange(Math.min(maxAyah, Math.max(1, Math.floor(n))))
        }}
      />
    </div>
  )
}

/** Max āyah count for surah from catalog, or null if unknown */
export function verseCountForSurah(chapters: ChapterSummary[] | null, surahId: number): number | null {
  const c = chapters?.find((x) => x.id === surahId)
  if (!c?.verses || c.verses < 1) return null
  return c.verses
}
