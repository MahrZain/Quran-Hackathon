import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { SURAH_LIST } from '../lib/mockData'

export function QuranListPage() {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return SURAH_LIST
    return SURAH_LIST.filter(
      (s) =>
        s.transliteration.toLowerCase().includes(needle) ||
        s.name.includes(needle) ||
        String(s.id).includes(needle),
    )
  }, [q])

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">Manuscript browser</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Surah index—search by name or number. Sample data; swap for your API.
        </p>
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
        />
      </label>

      <ul className="flex flex-col gap-2">
        {filtered.map((s) => (
          <li key={s.id}>
            <Link
              to={`/quran/${s.id}`}
              className="flex items-center justify-between gap-4 rounded-bento bg-surface-container-low px-5 py-4 shadow-ambient transition hover:bg-surface-container-highest hover:shadow-glass"
            >
              <div className="min-w-0">
                <p className="font-serif text-lg text-on-surface">{s.name}</p>
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
    </div>
  )
}
