const STORAGE_KEY = 'asar_bookmarks_v1'

export type QuranBookmark = {
  surah: number
  ayah: number
  addedAt: string
  note?: string
}

function parse(raw: string | null): QuranBookmark[] {
  if (!raw) return []
  try {
    const o = JSON.parse(raw) as unknown
    if (!Array.isArray(o)) return []
    const out: QuranBookmark[] = []
    for (const x of o) {
      if (!x || typeof x !== 'object') continue
      const r = x as Record<string, unknown>
      const surah = Number(r.surah)
      const ayah = Number(r.ayah)
      const addedAt = typeof r.addedAt === 'string' ? r.addedAt : ''
      const note = typeof r.note === 'string' ? r.note : undefined
      if (!Number.isFinite(surah) || surah < 1 || surah > 114) continue
      if (!Number.isFinite(ayah) || ayah < 1) continue
      const b: QuranBookmark = { surah, ayah, addedAt: addedAt || new Date().toISOString() }
      if (note) b.note = note
      out.push(b)
    }
    return out
  } catch {
    return []
  }
}

export function readBookmarks(): QuranBookmark[] {
  try {
    return parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

function write(list: QuranBookmark[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function addBookmark(entry: Omit<QuranBookmark, 'addedAt'> & { addedAt?: string }): QuranBookmark[] {
  const list = readBookmarks()
  const next: QuranBookmark = {
    surah: entry.surah,
    ayah: entry.ayah,
    addedAt: entry.addedAt ?? new Date().toISOString(),
    note: entry.note,
  }
  const filtered = list.filter((b) => !(b.surah === next.surah && b.ayah === next.ayah))
  const updated = [next, ...filtered]
  write(updated)
  return updated
}

export function removeBookmark(surah: number, ayah: number): QuranBookmark[] {
  const updated = readBookmarks().filter((b) => !(b.surah === surah && b.ayah === ayah))
  write(updated)
  return updated
}

export function hasBookmark(surah: number, ayah: number): boolean {
  return readBookmarks().some((b) => b.surah === surah && b.ayah === ayah)
}
