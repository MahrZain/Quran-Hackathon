import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AsarWordmark } from '../components/AsarWordmark'
import { useAuth } from '../context/AuthContext'
import { isAxiosError } from 'axios'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      await register(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const d = err.response?.data as { detail?: unknown } | undefined
        const det = d?.detail
        setError(typeof det === 'string' ? det : 'Could not create account.')
      } else {
        setError('Could not create account.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative min-h-svh overflow-x-hidden bg-surface font-body text-on-surface">
      <div className="fixed inset-0 z-0 overflow-x-hidden">
        <div className="organic-ripple absolute -left-[10%] -top-[20%] h-[80%] w-[80%] bg-surface-container-low opacity-60" />
        <div className="organic-ripple absolute -bottom-[10%] -right-[5%] h-[70%] w-[60%] bg-primary-container/10 opacity-40" />
      </div>

      <main className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 flex flex-col items-center">
          <AsarWordmark size="xl" className="text-primary-emerald" />
          <h1 className="mt-4 font-headline text-2xl font-semibold text-primary">Create account</h1>
          <p className="mt-2 text-center text-sm text-on-surface/65">Sign up with email to sync across devices.</p>
        </div>

        <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="reg-email" className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Email
            </label>
            <input
              id="reg-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-3 text-on-surface placeholder:text-on-surface/35 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="reg-pass" className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Password
            </label>
            <input
              id="reg-pass"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="reg-confirm" className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Confirm password
            </label>
            <input
              id="reg-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-4 text-sm font-semibold text-on-primary shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-on-surface/60">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-secondary hover:underline">
            Sign in
          </Link>
        </p>
        <Link to="/welcome" className="mt-4 text-sm text-primary/70 hover:underline">
          Back to welcome
        </Link>
      </main>
    </div>
  )
}
