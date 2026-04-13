import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { addBookmark, readBookmarks, removeBookmark, type QuranBookmark } from '../lib/bookmarks'

export function LibraryPage() {
  const [items, setItems] = useState<QuranBookmark[]>(() => readBookmarks())
  const [surah, setSurah] = useState('1')
  const [ayah, setAyah] = useState('1')
  const [note, setNote] = useState('')

  const refresh = useCallback(() => setItems(readBookmarks()), [])

  const add = useCallback(() => {
    const s = Number(surah)
    const a = Number(ayah)
    if (!Number.isFinite(s) || s < 1 || s > 114) return
    if (!Number.isFinite(a) || a < 1) return
    addBookmark({ surah: s, ayah: a, note: note.trim() || undefined })
    setNote('')
    refresh()
  }, [surah, ayah, note, refresh])

  const remove = useCallback(
    (b: QuranBookmark) => {
      removeBookmark(b.surah, b.ayah)
      refresh()
    },
    [refresh],
  )

  const sorted = useMemo(
    () => [...items].sort((x, y) => y.addedAt.localeCompare(x.addedAt)),
    [items],
  )

  return (
    <div className="mx-auto max-w-2xl px-4">
      <h1 className="font-headline text-3xl font-bold text-primary">Library</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Bookmarks are stored on this device only. Open any entry in the reader. Tafsīr and downloads can plug in here
        later.
      </p>

      <div className="mt-8 rounded-stitch border border-outline-variant/15 bg-surface-container-low p-6">
        <h2 className="font-semibold text-on-surface">Add bookmark</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field
            id="bk-surah"
            label="Surah (1–114)"
            inputMode="numeric"
            value={surah}
            onChange={(e) => setSurah(e.target.value)}
          />
          <Field
            id="bk-ayah"
            label="Āyah"
            inputMode="numeric"
            value={ayah}
            onChange={(e) => setAyah(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <Field
            id="bk-note"
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why this verse…"
          />
        </div>
        <Button type="button" className="mt-6" onClick={() => add()}>
          Save bookmark
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="font-headline text-xl text-primary">Saved verses</h2>
        {sorted.length === 0 ? (
          <p className="mt-4 text-sm text-on-surface/65">
            No bookmarks yet. Add one above or use <strong>Bookmark</strong> while reading a surah.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {sorted.map((b) => (
              <li
                key={`${b.surah}:${b.ayah}`}
                className="flex flex-col gap-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-on-surface">
                    Surah {b.surah} · Āyah {b.ayah}
                  </p>
                  {b.note ? <p className="mt-1 text-sm text-on-surface/70">{b.note}</p> : null}
                  <p className="mt-1 text-[10px] text-on-surface-variant/60">
                    {new Date(b.addedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/quran/${b.surah}?ayah=${b.ayah}`}
                    className="inline-flex rounded-full bg-primary/15 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/25"
                  >
                    Open in reader
                  </Link>
                  <Button type="button" variant="secondary" className="px-4 py-2 text-sm" onClick={() => remove(b)}>
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link to="/" className="mt-10 inline-block text-sm font-bold text-secondary hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
