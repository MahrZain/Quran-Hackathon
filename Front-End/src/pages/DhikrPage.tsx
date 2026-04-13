import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useMoodAyah } from '../context/MoodAyahContext'

const STORAGE_KEY = 'asar_dhikr_v1'

const PRESETS = [
  { id: 'subhan', label: 'Subḥān Allāh', target: 33 },
  { id: 'hamd', label: 'Alḥamdulillāh', target: 33 },
  { id: 'akbar', label: 'Allāhu akbar', target: 34 },
] as const

type PresetId = (typeof PRESETS)[number]['id']

function loadCount(preset: PresetId): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return 0
    const o = JSON.parse(raw) as Record<string, unknown>
    const n = Number(o[preset])
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

function saveCount(preset: PresetId, n: number) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const o = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    o[preset] = n
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o))
  } catch {
    /* ignore */
  }
}

export function DhikrPage() {
  const { streakCount } = useMoodAyah()
  const [preset, setPreset] = useState<PresetId>('subhan')
  const [count, setCount] = useState(0)

  useEffect(() => {
    setCount(loadCount(preset))
  }, [preset])

  const target = PRESETS.find((p) => p.id === preset)?.target ?? 33

  const increment = useCallback(() => {
    setCount((c) => {
      const next = c + 1
      saveCount(preset, next)
      return next
    })
  }, [preset])

  const reset = useCallback(() => {
    setCount(0)
    saveCount(preset, 0)
  }, [preset])

  const doneRound = count >= target

  return (
    <div className="mx-auto max-w-lg px-4">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary">Daily Dhikr</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Local counter only (saved in this browser). Pair with your dashboard streak when you mark an āyah.
          </p>
          <p className="mt-2 text-xs text-on-surface-variant/70">Current streak (session): {streakCount} days</p>
        </div>
        <span className="material-symbols-outlined text-4xl text-secondary" aria-hidden>
          potted_plant
        </span>
      </header>

      <div className="rounded-stitch bg-surface-container-low p-8 shadow-ambient">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-secondary">Phrase</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                preset === p.id
                  ? 'bg-primary text-on-primary shadow-ambient'
                  : 'bg-surface-container-highest/80 text-on-surface hover:bg-surface-container-high'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p
            className={`font-headline text-6xl tabular-nums text-primary sm:text-7xl ${
              doneRound ? 'text-secondary' : ''
            }`}
          >
            {count}
          </p>
          <p className="mt-2 text-sm text-on-surface-variant">
            Target {target} · {doneRound ? 'Round complete — reset or continue' : `${target - count} remaining`}
          </p>
        </div>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button type="button" className="min-w-[140px]" onClick={() => increment()}>
            +1
          </Button>
          <Button type="button" variant="secondary" onClick={() => reset()}>
            Reset
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-on-surface/55">
          Optional: use a short timer elsewhere; this screen stays lightweight so the app stays responsive.
        </p>

        <Link to="/" className="mt-6 block text-center text-sm font-bold text-secondary hover:underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
