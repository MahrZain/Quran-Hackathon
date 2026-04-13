import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

type ToggleProps = {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ id, label, description, checked, onChange }: ToggleProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-bento bg-surface-container-low px-5 py-4 shadow-ambient">
      <div>
        <label htmlFor={id} className="font-medium text-on-surface">
          {label}
        </label>
        <p className="mt-1 text-sm text-on-surface/60">{description}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-pill transition ${
          checked ? 'bg-primary-container' : 'bg-outline-variant/40'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition ${
            checked ? 'left-6' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [haptics, setHaptics] = useState(true)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [ayahNotes, setAyahNotes] = useState(true)

  return (
    <div className="mx-auto max-w-lg">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">Sanctuary settings</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Toggles and preferences from the mobile settings screen.
        </p>
        <Link
          to="/config"
          className="mt-4 inline-flex text-sm font-semibold text-secondary hover:underline"
        >
          Open sanctuary configuration (desktop)
        </Link>
      </header>

      <section className="mb-8 rounded-bento border border-outline-variant/15 bg-surface-container-low/60 p-5 shadow-ambient">
        <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Account
        </h2>
        {loading ? (
          <p className="mt-2 text-sm text-on-surface/60">Checking session…</p>
        ) : user ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-on-surface">
              Signed in as <span className="font-semibold text-primary">{user.email}</span>
            </p>
            {user.onboarding_completed ? (
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-low/80 p-4 text-sm text-on-surface/80">
                <h3 className="font-headline text-xs font-bold uppercase tracking-widest text-on-surface-variant">Reading path</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed">
                  <li>
                    Level: <span className="font-medium text-on-surface">{user.onboarding_level ?? '—'}</span>
                  </li>
                  <li>
                    Focus: <span className="font-medium text-on-surface">{user.onboarding_goal ?? '—'}</span>
                  </li>
                  <li>
                    Scope:{' '}
                    <span className="font-medium text-on-surface">
                      {user.reading_scope === 'single_surah'
                        ? `One surah${user.reading_scope_surah != null ? ` (#${user.reading_scope_surah})` : ''}`
                        : user.reading_scope === 'full_mushaf'
                          ? 'Full Qur’an'
                          : user.reading_scope ?? '—'}
                    </span>
                  </li>
                  <li>
                    Current verse:{' '}
                    <span className="font-medium text-on-surface">{user.current_verse_key ?? user.recommended_verse_key ?? '—'}</span>
                  </li>
                </ul>
                <Link
                  to="/settings/reading"
                  className="mt-3 inline-flex text-sm font-semibold text-secondary hover:underline"
                >
                  Change reading setup
                </Link>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/welcome', { replace: true })
              }}
              className="rounded-full border border-outline-variant/30 px-4 py-2 text-sm font-medium text-on-surface transition hover:bg-surface-container"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <Link
              to="/welcome"
              className="inline-flex rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
            >
              Sign in
            </Link>
            <p className="mt-2 text-xs text-on-surface/55">Use Try demo or Continue with Quran.com on the welcome screen.</p>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <Toggle
          id="haptics"
          label="Soft haptics"
          description="Light feedback on bead taps and completions."
          checked={haptics}
          onChange={setHaptics}
        />
        <Toggle
          id="motion"
          label="Reduce motion"
          description="Minimize parallax and large transitions."
          checked={reduceMotion}
          onChange={setReduceMotion}
        />
        <Toggle
          id="notes"
          label="Ayah notes cloud sync"
          description="Placeholder—connect storage when backend exists."
          checked={ayahNotes}
          onChange={setAyahNotes}
        />
      </div>
    </div>
  )
}
