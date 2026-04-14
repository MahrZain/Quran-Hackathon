import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { useAuth } from '../context/AuthContext'
import type { VerseBookmarkOut } from '../lib/apiTypes'
import {
  addBookmark,
  BOOKMARKS_LOCAL_STORAGE_KEY,
  BOOKMARKS_MERGED_TO_API_KEY,
  readBookmarks,
  removeBookmark,
} from '../lib/bookmarks'
import { createBookmarkApi, deleteBookmarkApi, fetchBookmarks } from '../lib/bookmarksApi'

type Row = {
  surah: number
  ayah: number
  note?: string
  addedAt: string
  quran_sync_status?: VerseBookmarkOut['quran_sync_status']
}

function cloudRows(list: VerseBookmarkOut[]): Row[] {
  return list.map((b) => ({
    surah: b.surah_id,
    ayah: b.ayah_number,
    note: b.note ?? undefined,
    addedAt: b.created_at,
    quran_sync_status: b.quran_sync_status,
  }))
}

function localRows(): Row[] {
  return readBookmarks().map((b) => ({
    surah: b.surah,
    ayah: b.ayah,
    note: b.note,
    addedAt: b.addedAt,
  }))
}

async function mergeLocalBookmarksIntoApi(): Promise<void> {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(BOOKMARKS_MERGED_TO_API_KEY) === '1') return
  const local = readBookmarks()
  if (local.length === 0) {
    localStorage.setItem(BOOKMARKS_MERGED_TO_API_KEY, '1')
    return
  }
  let remote: VerseBookmarkOut[] = []
  try {
    remote = await fetchBookmarks()
  } catch {
    return
  }
  const have = new Set(remote.map((r) => `${r.surah_id}:${r.ayah_number}`))
  for (const b of local) {
    const k = `${b.surah}:${b.ayah}`
    if (have.has(k)) continue
    try {
      await createBookmarkApi({
        surah_id: b.surah,
        ayah_number: b.ayah,
        note: b.note ?? null,
      })
    } catch {
      return
    }
  }
  try {
    localStorage.removeItem(BOOKMARKS_LOCAL_STORAGE_KEY)
  } catch {
    /* ignore */
  }
  localStorage.setItem(BOOKMARKS_MERGED_TO_API_KEY, '1')
}

export function LibraryPage() {
  const { user } = useAuth()
  const [items, setItems] = useState<Row[]>(() => (user ? [] : localRows()))
  const [loading, setLoading] = useState(Boolean(user))
  const [surah, setSurah] = useState('1')
  const [ayah, setAyah] = useState('1')
  const [note, setNote] = useState('')

  const refresh = useCallback(async () => {
    if (!user) {
      setItems(localRows())
      return
    }
    try {
      const list = await fetchBookmarks()
      setItems(cloudRows(list))
    } catch {
      /* keep existing rows */
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setItems(localRows())
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        await mergeLocalBookmarksIntoApi()
        const list = await fetchBookmarks()
        if (!cancelled) setItems(cloudRows(list))
      } catch {
        if (!cancelled) setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const add = useCallback(async () => {
    const s = Number(surah)
    const a = Number(ayah)
    if (!Number.isFinite(s) || s < 1 || s > 114) return
    if (!Number.isFinite(a) || a < 1) return
    const n = note.trim() || undefined
    if (!user) {
      addBookmark({ surah: s, ayah: a, note: n })
      setNote('')
      setItems(localRows())
      return
    }
    try {
      await createBookmarkApi({ surah_id: s, ayah_number: a, note: n ?? null })
      setNote('')
      await refresh()
    } catch {
      /* ignore; optional toast */
    }
  }, [surah, ayah, note, user, refresh])

  const remove = useCallback(
    async (b: Row) => {
      if (!user) {
        removeBookmark(b.surah, b.ayah)
        setItems(localRows())
        return
      }
      try {
        await deleteBookmarkApi(b.surah, b.ayah)
        await refresh()
      } catch {
        /* ignore */
      }
    },
    [user, refresh],
  )

  const sorted = useMemo(
    () => [...items].sort((x, y) => y.addedAt.localeCompare(x.addedAt)),
    [items],
  )

  return (
    <div className="mx-auto max-w-2xl px-4">
      <h1 className="font-headline text-3xl font-bold text-primary">Library</h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        {user ? (
          <>
            Bookmarks are saved to your ASAR account. If you use Continue with Quran.com with the{' '}
            <code className="text-xs text-on-surface/70">bookmark</code> OAuth scope, they can also sync in the
            background to Quran Foundation (see server logs if sync stays pending).
          </>
        ) : (
          <>
            Bookmarks stay on this device until you sign in; then they can be merged to your account from this page.
            Open any entry in the reader.
          </>
        )}
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
            label="Ayah"
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
        <Button type="button" className="mt-6" onClick={() => void add()}>
          Save bookmark
        </Button>
      </div>

      <div className="mt-10">
        <h2 className="font-headline text-xl text-primary">Saved verses</h2>
        {loading ? (
          <p className="mt-4 text-sm text-on-surface/65">Loading bookmarks…</p>
        ) : sorted.length === 0 ? (
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
                    Surah {b.surah} · Ayah {b.ayah}
                  </p>
                  {b.note ? <p className="mt-1 text-sm text-on-surface/70">{b.note}</p> : null}
                  <p className="mt-1 text-[10px] text-on-surface-variant/60">
                    {new Date(b.addedAt).toLocaleString()}
                    {user && b.quran_sync_status ? (
                      <span className="ml-2 rounded bg-surface-container-high px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-on-surface-variant">
                        Quran sync: {b.quran_sync_status}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/quran/${b.surah}?ayah=${b.ayah}`}
                    className="inline-flex rounded-full bg-primary/15 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/25"
                  >
                    Open in reader
                  </Link>
                  <Button type="button" variant="secondary" className="px-4 py-2 text-sm" onClick={() => void remove(b)}>
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
