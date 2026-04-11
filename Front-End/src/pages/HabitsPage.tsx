import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const heatLevels = [
  'bg-surface-container-highest',
  'bg-primary-fixed-dim',
  'bg-primary-container',
  'bg-primary',
] as const

type Reflection = {
  id: string
  month: string
  day: string
  surah: string
  ayah: string
  body: string
  variant: 'filled' | 'quiet'
}

const reflections: Reflection[] = [
  {
    id: '1',
    month: 'Oct',
    day: '24',
    surah: 'Surah Al-Kahf',
    ayah: 'Ayah 10',
    body: '"Reflected on the concept of mercy as a shelter. Just as the youth found safety in the cave, true sanctuary is found in God\'s remembrance amidst chaos."',
    variant: 'filled',
  },
  {
    id: '2',
    month: 'Oct',
    day: '23',
    surah: 'Surah An-Nur',
    ayah: 'Ayah 35',
    body: 'The Ayat an-Nur brought a profound sense of clarity today. Visualized the niche and the lamp as the human heart receiving the light of guidance.',
    variant: 'filled',
  },
  {
    id: '3',
    month: 'Oct',
    day: '22',
    surah: '',
    ayah: '',
    body: 'No reflection recorded for this day. Quiet presence only.',
    variant: 'quiet',
  },
]

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden>
      {name}
    </span>
  )
}

export function HabitsPage() {
  const [done, setDone] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
  })

  const heatmapColumns = useMemo(() => {
    const cols = 40
    const rows = 7
    return Array.from({ length: cols }, (_, i) =>
      Array.from({ length: rows }, (_, j) => {
        const idx = (i * 3 + j * 5) % 4
        const level = heatLevels[idx]
        const glow = level === 'bg-primary' ? 'shadow-[0_0_8px_rgba(0,53,39,0.25)]' : ''
        return { level, glow }
      }),
    )
  }, [])

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-headline text-3xl tracking-tight text-primary sm:text-4xl">
            History Ledger
          </h1>
          <p className="mt-2 max-w-2xl text-base text-on-surface-variant/70">
            Tracing the beads of your spiritual journey. Every dot is a breath of connection, every
            line a moment of growth.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-outline-variant/15 bg-surface-container-low px-3 py-2 sm:px-4">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search reflections…"
            className="w-40 border-0 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:ring-0 md:w-48"
            aria-label="Search reflections"
          />
        </div>
      </header>

      <section className="mb-8 rounded-stitch bg-surface-container-low p-5 shadow-ambient">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">
          This week — habit beads
        </p>
        <div className="flex justify-between gap-2">
          {days.map((label, i) => {
            const active = done[i]
            return (
              <button
                key={`${label}-${i}`}
                type="button"
                onClick={() => setDone((d) => ({ ...d, [i]: !d[i] }))}
                className={`flex flex-1 flex-col items-center gap-2 rounded-xl py-3 text-xs font-medium transition ${
                  active
                    ? 'bg-primary-container text-on-primary shadow-ambient'
                    : 'bg-surface-container-highest/60 text-on-surface/55 hover:bg-surface-container-high'
                }`}
              >
                <span
                  className={`h-3 w-3 rounded-full ${
                    active ? 'bg-primary-fixed ring-2 ring-primary-fixed-dim' : 'bg-outline-variant/40'
                  }`}
                />
                {label}
              </button>
            )
          })}
        </div>
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
                <h2 className="font-headline text-xl text-primary">Connection Heatmap</h2>
                <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant/60">
                  Annual Quranic Rhythm
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-on-surface-variant/60">Less</span>
                <div className="h-3 w-3 rounded-full bg-surface-container-highest" />
                <div className="h-3 w-3 rounded-full bg-primary-fixed-dim" />
                <div className="h-3 w-3 rounded-full bg-primary-container" />
                <div className="h-3 w-3 rounded-full bg-primary" />
                <span className="text-xs text-on-surface-variant/60">More</span>
              </div>
            </div>
            <div className="hide-scrollbar flex gap-1 overflow-x-auto pb-4">
              {heatmapColumns.map((column, ci) => (
                <div key={`w-${ci}`} className="flex flex-col gap-1">
                  {column.map((cell, ri) => (
                    <div
                      key={`${ci}-${ri}`}
                      className={`h-3 w-3 rounded-full ${cell.level} ${cell.glow}`}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between text-[10px] font-label uppercase tracking-widest text-on-surface-variant/40">
              <span>January</span>
              <span>April</span>
              <span>July</span>
              <span>October</span>
              <span>December</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:col-span-6 lg:col-span-4">
          <div className="group flex-1 rounded-[2rem] bg-surface-container-low p-6 transition-all hover:bg-surface-container-highest sm:p-8">
            <div className="mb-6 flex items-start justify-between">
              <Icon name="all_inclusive" />
              <span className="text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant/60">
                Total Connection
              </span>
            </div>
            <p className="font-headline mb-1 text-4xl text-primary sm:text-5xl">1,284</p>
            <p className="text-sm text-on-surface-variant/70">ASAR Moments recorded since inception.</p>
            <button
              type="button"
              className="mt-6 flex items-center border-t border-outline-variant/15 pt-6 text-xs font-medium uppercase tracking-widest text-secondary"
            >
              View Milestones
              <span className="material-symbols-outlined ml-2 text-sm transition-transform group-hover:translate-x-1">
                arrow_forward
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
                  Current Flow
                </span>
              </div>
              <p className="font-headline mb-1 text-4xl text-secondary-fixed sm:text-5xl">42</p>
              <p className="text-sm opacity-80">Consecutive days of spiritual presence.</p>
              <div className="mt-6 flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-secondary-fixed" />
                <div className="h-2 w-2 rounded-full bg-secondary-fixed" />
                <div className="h-2 w-2 rounded-full bg-secondary-fixed shadow-[0_0_8px_#fed65b]" />
                <div className="ml-2 h-2 w-2 rounded-full bg-white/20" />
                <div className="h-2 w-2 rounded-full bg-white/20" />
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-12">
          <div className="mb-8 flex flex-col gap-4 px-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-headline text-2xl text-primary">Daily Reflections</h2>
              <p className="text-sm text-on-surface-variant/60">Your modern manuscript of soul-growth.</p>
            </div>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest text-secondary transition-all hover:bg-surface-container-low"
            >
              Filter By Surah
              <Icon name="expand_more" />
            </button>
          </div>

          <div className="space-y-4">
            {reflections.map((r) =>
              r.variant === 'quiet' ? (
                <div
                  key={r.id}
                  className="flex flex-col items-start gap-6 rounded-3xl border border-dashed border-outline-variant/30 bg-surface-container-lowest/50 p-6 opacity-70 md:flex-row md:items-center"
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant/40">
                      {r.month}
                    </p>
                    <p className="font-headline text-2xl text-on-surface-variant/40">{r.day}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm tracking-wide text-on-surface-variant/60">{r.body}</p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1 font-label text-[10px] font-bold uppercase tracking-widest text-secondary hover:underline"
                  >
                    Add Note
                    <Icon name="add" />
                  </button>
                </div>
              ) : (
                <div
                  key={r.id}
                  className="asar-glass flex flex-col items-start gap-6 rounded-3xl p-6 transition-all hover:bg-surface-container-low/60 md:flex-row md:items-center"
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="mb-1 text-[10px] font-label uppercase tracking-widest text-on-surface-variant/40">
                      {r.month}
                    </p>
                    <p className="font-headline text-2xl text-primary">{r.day}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-primary-fixed-dim/30 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary-container">
                        {r.surah}
                      </span>
                      <span className="text-xs tracking-widest text-on-surface-variant/40">{r.ayah}</span>
                    </div>
                    <p className="italic leading-relaxed text-on-surface">{r.body}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant/40 transition-all hover:bg-white/50 hover:text-secondary"
                      aria-label="Edit reflection"
                    >
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant/40 transition-all hover:bg-white/50 hover:text-primary"
                      aria-label="Share reflection"
                    >
                      <Icon name="share" />
                    </button>
                  </div>
                </div>
              ),
            )}

            <div className="flex justify-center py-8">
              <button
                type="button"
                className="flex items-center gap-3 rounded-full bg-surface-container px-8 py-3 font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant transition-all hover:bg-surface-container-highest"
              >
                Load Earlier Beads
                <Icon name="keyboard_double_arrow_down" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-10 text-center text-sm text-on-surface-variant/55">
        Matches Stitch desktop{' '}
        <span className="font-medium text-on-surface/70">Habit Beads Ledger — ASAR History</span>.{' '}
        <Link to="/" className="text-secondary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  )
}
