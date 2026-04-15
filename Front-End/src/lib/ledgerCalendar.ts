/**
 * Civil calendar helpers aligned with server ledger day (IANA zone from /auth/me).
 * Activity dates are YYYY-MM-DD strings in that zone’s calendar.
 */

const DOW_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/** YYYY-MM-DD for `instant` in `timeZone` (e.g. Asia/Karachi). */
export function ymdInTimeZone(instant: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  let y = ''
  let m = ''
  let d = ''
  for (const p of fmt.formatToParts(instant)) {
    if (p.type === 'year') y = p.value
    if (p.type === 'month') m = p.value
    if (p.type === 'day') d = p.value
  }
  return `${y}-${m}-${d}`
}

/** Gregorian calendar add on Y-M-D strings (matches server date arithmetic). */
export function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  const u = Date.UTC(y, m - 1, d + deltaDays)
  const x = new Date(u)
  const mm = String(x.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(x.getUTCDate()).padStart(2, '0')
  return `${x.getUTCFullYear()}-${mm}-${dd}`
}

/** 0 = Sunday … 6 = Saturday for `instant` in `timeZone`. */
export function weekdaySun0InTimeZone(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).formatToParts(instant)
  const label = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  return DOW_MAP[label] ?? 0
}

export function buildLedgerHeatmapCells(
  ymdSet: Set<string>,
  cols: number,
  rows: number,
  timeZone: string,
): { levelIdx: number; glow: string; ymd: string; hasMark: boolean }[][] {
  const totalDays = cols * rows
  const todayYmd = ymdInTimeZone(new Date(), timeZone)
  const glowCls = 'shadow-[0_0_8px_rgba(0,53,39,0.25)]'

  const columns: { levelIdx: number; glow: string; ymd: string; hasMark: boolean }[][] = []
  for (let c = 0; c < cols; c++) {
    const column: { levelIdx: number; glow: string; ymd: string; hasMark: boolean }[] = []
    for (let r = 0; r < rows; r++) {
      const offset = c * rows + r
      const key = addCalendarDaysYmd(todayYmd, -(totalDays - 1 - offset))
      const has = ymdSet.has(key)
      column.push({
        levelIdx: has ? 3 : 0,
        glow: has ? glowCls : '',
        ymd: key,
        hasMark: has,
      })
    }
    columns.push(column)
  }
  return columns
}

export function countDaysThisLedgerWeek(
  activityYmds: Iterable<string>,
  timeZone: string,
): { marked: number; startYmd: string } {
  const now = new Date()
  const todayYmd = ymdInTimeZone(now, timeZone)
  const dow = weekdaySun0InTimeZone(now, timeZone)
  const startYmd = addCalendarDaysYmd(todayYmd, -dow)
  const set = new Set(activityYmds)
  let n = 0
  for (let i = 0; i < 7; i++) {
    if (set.has(addCalendarDaysYmd(startYmd, i))) n += 1
  }
  return { marked: n, startYmd }
}
