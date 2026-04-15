import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import type { StreakActivityItem } from '../lib/apiTypes'
import { fetchStreakActivitiesDeduped, invalidateStreakActivitiesCache } from '../lib/engineDataCache'
import {
  addCalendarDaysYmd,
  buildLedgerHeatmapCells,
  countDaysThisLedgerWeek,
  weekdaySun0InTimeZone,
  ymdInTimeZone,
} from '../lib/ledgerCalendar'

const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const

const heatLevels = [
  'bg-surface-container-highest',
  'bg-primary-fixed-dim',
  'bg-primary-container',
  'bg-primary',
] as const

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden>
      {name}
    </span>
  )
}

function formatActivityLabel(ymd: string): { month: string; day: string } {
  const [y, m, d] = ymd.split('-').map((x) => Number(x))
  if (!y || !m || !d) return { month: '—', day: '—' }
  const dt = new Date(Date.UTC(y, m - 1, d))
  return {
    month: dt.toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
    day: String(d),
  }
}

const DEFAULT_LEDGER_TZ = 'Asia/Karachi'

export function HabitsPage() {
  const { user } = useAuth()
  const { sessionId } = useAppSession()
  const { streakCount } = useMoodAyah()
  const ledgerTz = (user?.ledger_timezone ?? DEFAULT_LEDGER_TZ).trim() || DEFAULT_LEDGER_TZ
  const tzShort = ledgerTz.includes('/') ? ledgerTz.split('/').pop() ?? ledgerTz : ledgerTz

  const [activities, setActivities] = useState<StreakActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(
    (opts?: { bustCache?: boolean }) => {
      setLoading(true)
      setErr(null)
      if (opts?.bustCache) {
        invalidateStreakActivitiesCache(sessionId, 200)
      }
      void fetchStreakActivitiesDeduped(sessionId, 200)
        .then((rows) => setActivities(rows))
        .catch(() => {
          setErr('Could not load mark-complete history. Is the ASAR Engine running?')
          setActivities([])
        })
        .finally(() => setLoading(false))
    },
    [sessionId],
  )

  useEffect(() => {
    queueMicrotask(() => void load())
  }, [load])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ bustCache: true })
    }
    const onLedgerRefresh = () => void load({ bustCache: true })
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('asar:ledger-refresh', onLedgerRefresh)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('asar:ledger-refresh', onLedgerRefresh)
    }
  }, [load])

  const ymdSet = useMemo(() => new Set(activities.map((a) => a.activity_date)), [activities])

  const heatmapColumns = useMemo(
    () => buildLedgerHeatmapCells(ymdSet, 26, 7, ledgerTz),
    [ymdSet, ledgerTz],
  )

  const weekLedger = useMemo(
    () => countDaysThisLedgerWeek(activities.map((a) => a.activity_date), ledgerTz),
    [activities, ledgerTz],
  )

  const done = useMemo(() => {
    const now = new Date()
    const todayStr = ymdInTimeZone(now, ledgerTz)
    const dow = weekdaySun0InTimeZone(now, ledgerTz)
    const startYmd = addCalendarDaysYmd(todayStr, -dow)
    const set = new Set(activities.map((a) => a.activity_date))
    const next: Record<number, boolean> = {}
    for (let i = 0; i < 7; i++) {
      next[i] = set.has(addCalendarDaysYmd(startYmd, i))
    }
    return next
  }, [activities, ledgerTz])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return activities
    return activities.filter(
      (a) =>
        a.ayah_read.toLowerCase().includes(needle) || a.activity_date.toLowerCase().includes(needle),
    )
  }, [activities, q])

  const totalDays = activities.length

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl tracking-tight text-primary sm:text-4xl">History Ledger</h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant/70">
            Mark-complete days from your ASAR session ({tzShort} calendar). Heatmap and list sync on refresh, when you
            return to this tab, or after you mark complete on the dashboard.
          </p>
          {err ? <p className="mt-2 text-xs text-error">{err}</p> : null}
        </div>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-low px-3 py-2 sm:px-4">
          <Icon name="search" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by date or verse key…"
            className="w-40 border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 md:w-48"
            aria-label="Search ledger"
          />
        </div>
      </header>

      <section className="mb-8 rounded-stitch bg-surface-container-low p-5 shadow-ambient">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">
          This week ({tzShort}) — days with a logged mark
        </p>
        <div className="flex justify-between gap-2">
          {days.map((label, i) => {
            const active = done[i]
            return (
              <div
                key={`${label}-${i}`}
                className={`flex flex-1 flex-col items-center gap-2 rounded-xl py-3 text-xs font-medium ${
                  active
                    ? 'bg-primary-container text-on-primary shadow-ambient'
                    : 'bg-surface-container-highest/60 text-on-surface/55'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full ${
                    active ? 'bg-primary-fixed ring-2 ring-primary-fixed-dim' : 'bg-outline-variant/40'
                  }`}
                />
                {label}
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-on-surface-variant/60">
          {weekLedger.marked} of 7 days this {tzShort} week have a streak entry.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[2rem] bg-surface-container-low p-6 sm:p-8 md:col-span-12 lg:col-span-8">
          <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-10">
            <span className="material-symbols-outlined block text-[120px] text-primary" aria-hidden>
              grain
            </span>
          </div>
          <div className="relative z-10">
            <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-headline text-xl text-primary">Connection heatmap</h2>
                <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/60">
                  Last {26 * 7} days ({tzShort}) · darker = mark logged
                </p>
              </div>
            </div>
            {loading ? (
              <p className="text-sm text-on-surface/60">Loading activity…</p>
            ) : (
              <div className="hide-scrollbar flex gap-1 overflow-x-auto pb-4">
                {heatmapColumns.map((column, ci) => (
                  <div key={`w-${ci}`} className="flex flex-col gap-1">
                    {column.map((cell, ri) => (
                      <div
                        key={`${ci}-${ri}`}
                        className={`h-3 w-3 rounded-full ${heatLevels[cell.levelIdx]!} ${cell.glow}`}
                        title={cell.hasMark ? `${cell.ymd} · mark logged` : cell.ymd}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6 md:col-span-6 lg:col-span-4">
          <div className="group flex-1 rounded-[2rem] bg-surface-container-low p-6 transition-all hover:bg-surface-container-highest sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <Icon name="all_inclusive" />
              <span className="text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant/60">
                Days logged
              </span>
            </div>
            <p className="font-headline mb-1 text-4xl text-primary sm:text-5xl">{totalDays}</p>
            <p className="text-sm text-on-surface-variant/70">Distinct days with “Mark complete” in this session.</p>
            <button
              type="button"
              onClick={() => load({ bustCache: true })}
              className="mt-6 flex items-center border-t border-outline-variant/15 pt-6 text-xs font-medium uppercase tracking-widest text-secondary"
            >
              Refresh ledger
              <span className="material-symbols-outlined ml-2 text-sm transition-transform group-hover:translate-x-1">
                refresh
              </span>
            </button>
          </div>

          <div className="relative flex-1 overflow-hidden rounded-[2rem] bg-primary p-6 text-on-primary shadow-[0_12px_40px_rgba(0,53,39,0.15)] sm:p-8">
            <div className="pointer-events-none absolute -bottom-4 -right-4 opacity-10">
              <span className="material-symbols-outlined text-9xl text-on-primary" aria-hidden>
                auto_awesome
              </span>
            </div>
            <div className="relative z-10">
              <div className="mb-6 flex items-start justify-between text-primary-fixed-dim">
                <Icon name="bolt" />
                <span className="text-[10px] font-label uppercase tracking-[0.2em] opacity-80">
                  Current streak
                </span>
              </div>
              <p className="font-headline mb-1 text-4xl text-secondary-fixed sm:text-5xl">{streakCount}</p>
              <p className="text-sm opacity-80">From dashboard / engine streak snapshot (same as home).</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-12">
          <div className="mb-8 flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-headline text-2xl text-primary">Mark-complete log</h2>
              <p className="text-sm text-on-surface-variant/60">Newest first · open the reader for any āyah.</p>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-sm text-on-surface/60">Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container-lowest/50 p-8 text-center">
                <p className="text-sm text-on-surface-variant/70">
                  {activities.length === 0
                    ? 'No streak rows yet. Tap Mark complete on the dashboard after a read.'
                    : 'No entries match your search.'}
                </p>
              </div>
            ) : (
              filtered.map((a) => {
                const { month, day } = formatActivityLabel(a.activity_date)
                const [su, ay] = a.ayah_read.split(':')
                const surahNum = su ? Number(su) : NaN
                const ayahNum = ay ? Number(ay) : NaN
                const readerOk = Number.isFinite(surahNum) && surahNum >= 1 && surahNum <= 114 && Number.isFinite(ayahNum) && ayahNum >= 1
                return (
                  <div
                    key={`${a.activity_date}-${a.ayah_read}`}
                    className="asar-glass flex flex-col items-start gap-6 rounded-3xl p-6 transition-all hover:bg-surface-container-low/60 md:flex-row md:items-center"
                  >
                    <div className="w-16 shrink-0 text-center">
                      <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant/40">
                        {month}
                      </p>
                      <p className="font-headline text-2xl text-primary">{day}</p>
                      <p className="mt-1 text-[10px] text-on-surface-variant/50">{a.activity_date}</p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <span className="rounded-full bg-primary-fixed-dim/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-container">
                          {a.ayah_read}
                        </span>
                      </div>
                      <p className="leading-relaxed text-on-surface/85">
                        Marked complete for this {tzShort} calendar day.{' '}
                        {readerOk ? (
                          <Link
                            to={`/quran/${surahNum}?ayah=${ayahNum}`}
                            className="font-semibold text-secondary hover:underline"
                          >
                            Open in reader
                          </Link>
                        ) : null}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-on-surface-variant/55">
        Data from <span className="font-medium text-on-surface/70">GET /streak/…/activities</span>. Ledger day:{' '}
        <span className="font-medium text-on-surface/70">{ledgerTz}</span>.{' '}
        <Link to="/" className="text-secondary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  )
}
