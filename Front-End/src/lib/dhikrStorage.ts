/** Legacy key: only stored per-preset counts as flat numbers. */
export const DHIKR_LEGACY_STORAGE_KEY = 'asar_dhikr_v1'
export const DHIKR_STORAGE_KEY = 'asar_dhikr_v2'

export type DhikrEntry = {
  id: string
  label: string
  target: number
  builtIn?: true
}

export const BUILTIN_DHIKR: readonly DhikrEntry[] = [
  { id: 'subhan', label: 'Subḥān Allāh', target: 33, builtIn: true },
  { id: 'hamd', label: 'Alḥamdulillāh', target: 33, builtIn: true },
  { id: 'akbar', label: 'Allāhu akbar', target: 34, builtIn: true },
] as const

export type DhikrPersisted = {
  version: 2
  customs: DhikrEntry[]
  counts: Record<string, number>
}

const MAX_LABEL_LEN = 120
const MIN_TARGET = 1
const MAX_TARGET = 9999

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.min(hi, Math.max(lo, Math.floor(n)))
}

function newCustomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `dhikr_${crypto.randomUUID()}`
  }
  return `dhikr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function migrateLegacyCounts(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DHIKR_LEGACY_STORAGE_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const id of BUILTIN_DHIKR) {
      const n = Number(o[id.id])
      if (Number.isFinite(n) && n >= 0) out[id.id] = Math.floor(n)
    }
    return out
  } catch {
    return {}
  }
}

function sanitizeCustoms(raw: unknown): DhikrEntry[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: DhikrEntry[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const id = typeof r.id === 'string' && r.id.length > 0 ? r.id.slice(0, 80) : newCustomId()
    if (BUILTIN_DHIKR.some((b) => b.id === id) || seen.has(id)) continue
    seen.add(id)
    let label = typeof r.label === 'string' ? r.label.trim() : ''
    if (!label) continue
    if (label.length > MAX_LABEL_LEN) label = label.slice(0, MAX_LABEL_LEN)
    const target = clampInt(Number(r.target), MIN_TARGET, MAX_TARGET)
    out.push({ id, label, target })
  }
  return out
}

function sanitizeCounts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(o)) {
    if (typeof k !== 'string' || !k) continue
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) out[k] = Math.floor(n)
  }
  return out
}

export function loadDhikrPersisted(): DhikrPersisted {
  try {
    const raw = localStorage.getItem(DHIKR_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DhikrPersisted>
      if (parsed.version === 2) {
        return {
          version: 2,
          customs: sanitizeCustoms(parsed.customs),
          counts: sanitizeCounts(parsed.counts),
        }
      }
    }
  } catch {
    /* ignore */
  }
  const migrated = migrateLegacyCounts()
  const fresh: DhikrPersisted = { version: 2, customs: [], counts: migrated }
  if (Object.keys(migrated).length > 0) {
    try {
      localStorage.setItem(DHIKR_STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      /* ignore */
    }
  }
  return fresh
}

export function saveDhikrPersisted(state: DhikrPersisted): void {
  try {
    localStorage.setItem(DHIKR_STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function parseNewCustom(
  labelRaw: string,
  targetRaw: string | number
): { ok: true; label: string; target: number; id: string } | { ok: false; error: string } {
  const label = labelRaw.trim()
  if (!label) return { ok: false, error: 'Enter a phrase for your dhikr.' }
  if (label.length > MAX_LABEL_LEN) {
    return { ok: false, error: `Keep the phrase under ${MAX_LABEL_LEN} characters.` }
  }
  const raw =
    typeof targetRaw === 'number' ? targetRaw : Number(String(targetRaw).trim().replace(/,/g, ''))
  if (!Number.isFinite(raw) || !Number.isInteger(raw)) {
    return { ok: false, error: 'Target must be a whole number.' }
  }
  if (raw < MIN_TARGET || raw > MAX_TARGET) {
    return { ok: false, error: `Use a target between ${MIN_TARGET} and ${MAX_TARGET}.` }
  }
  return { ok: true, label, target: raw, id: newCustomId() }
}
