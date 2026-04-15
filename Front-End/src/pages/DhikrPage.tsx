import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useMoodAyah } from '../context/MoodAyahContext'
import {
  BUILTIN_DHIKR,
  loadDhikrPersisted,
  parseNewCustom,
  saveDhikrPersisted,
  type DhikrEntry,
  type DhikrPersisted,
} from '../lib/dhikrStorage'

export function DhikrPage() {
  const { streakCount } = useMoodAyah()
  const [persisted, setPersisted] = useState<DhikrPersisted>(loadDhikrPersisted)
  const [activeId, setActiveId] = useState<string>(BUILTIN_DHIKR[0].id)
  const [newLabel, setNewLabel] = useState('')
  const [newTarget, setNewTarget] = useState('100')
  const [formError, setFormError] = useState<string | null>(null)

  const entries = useMemo(
    () => [...BUILTIN_DHIKR, ...persisted.customs] as DhikrEntry[],
    [persisted.customs]
  )

  const active = useMemo(() => {
    const found = entries.find((e) => e.id === activeId)
    return found ?? BUILTIN_DHIKR[0]
  }, [entries, activeId])

  const count = persisted.counts[active.id] ?? 0
  const target = active.target
  const doneRound = count >= target

  const increment = useCallback(() => {
    setPersisted((p) => {
      const cur = p.counts[activeId] ?? 0
      const next = { ...p, counts: { ...p.counts, [activeId]: cur + 1 } }
      saveDhikrPersisted(next)
      return next
    })
  }, [activeId])

  const reset = useCallback(() => {
    setPersisted((p) => {
      const next = { ...p, counts: { ...p.counts, [activeId]: 0 } }
      saveDhikrPersisted(next)
      return next
    })
  }, [activeId])

  const addCustom = useCallback(() => {
    const parsed = parseNewCustom(newLabel, newTarget)
    if (!parsed.ok) {
      setFormError(parsed.error)
      return
    }
    setFormError(null)
    setPersisted((p) => {
      const next: DhikrPersisted = {
        ...p,
        customs: [...p.customs, { id: parsed.id, label: parsed.label, target: parsed.target }],
      }
      saveDhikrPersisted(next)
      return next
    })
    setActiveId(parsed.id)
    setNewLabel('')
    setNewTarget(String(parsed.target))
  }, [newLabel, newTarget])

  const removeCustom = useCallback((id: string) => {
    setPersisted((p) => {
      const next: DhikrPersisted = {
        ...p,
        customs: p.customs.filter((c) => c.id !== id),
        counts: Object.fromEntries(Object.entries(p.counts).filter(([k]) => k !== id)),
      }
      saveDhikrPersisted(next)
      return next
    })
    setActiveId((cur) => (cur === id ? BUILTIN_DHIKR[0].id : cur))
  }, [])

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
          {entries.map((p) => (
            <div key={p.id} className="flex max-w-full items-center gap-0.5">
              <button
                type="button"
                onClick={() => setActiveId(p.id)}
                title={p.label}
                className={`max-w-[min(100%,14rem)] truncate rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeId === p.id
                    ? 'bg-primary text-on-primary shadow-ambient'
                    : 'bg-surface-container-highest/80 text-on-surface hover:bg-surface-container-high'
                }`}
              >
                {p.label}
                <span className="ml-1.5 tabular-nums opacity-80">({p.target})</span>
              </button>
              {!p.builtIn && (
                <button
                  type="button"
                  onClick={() => removeCustom(p.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-error"
                  aria-label={`Remove ${p.label}`}
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden>
                    close
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 border-t border-outline-variant/15 pt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-secondary">Your dhikr</p>
          <p className="mb-3 text-xs text-on-surface-variant">
            Add any phrase and how many times you want to count toward it today.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 text-xs text-on-surface-variant">
              <span className="mb-1 block font-semibold text-on-surface/80">Phrase</span>
              <input
                className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-high/50 px-3 py-2.5 text-sm text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                placeholder="e.g. Lā ilāha illallāh"
                type="text"
                autoComplete="off"
                value={newLabel}
                onChange={(e) => {
                  setNewLabel(e.target.value)
                  if (formError) setFormError(null)
                }}
              />
            </label>
            <label className="w-full shrink-0 sm:w-28">
              <span className="mb-1 block text-xs font-semibold text-on-surface/80">Target</span>
              <input
                className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-high/50 px-3 py-2.5 text-sm tabular-nums text-on-surface outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                type="number"
                inputMode="numeric"
                min={1}
                max={9999}
                value={newTarget}
                onChange={(e) => {
                  setNewTarget(e.target.value)
                  if (formError) setFormError(null)
                }}
              />
            </label>
            <Button type="button" className="w-full shrink-0 sm:w-auto sm:self-end" onClick={addCustom}>
              Add
            </Button>
          </div>
          {formError && <p className="mt-2 text-xs font-medium text-error">{formError}</p>}
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
            Target {target} · {doneRound ? 'Round complete — reset or continue' : `${Math.max(0, target - count)} remaining`}
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
