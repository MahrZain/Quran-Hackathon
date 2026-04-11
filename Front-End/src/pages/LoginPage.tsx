import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { AsarWordmark } from '../components/AsarWordmark'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      if (isAxiosError(err)) {
        const d = err.response?.data as { detail?: unknown } | undefined
        const det = d?.detail
        setError(typeof det === 'string' ? det : 'Sign in failed.')
      } else {
        setError('Sign in failed.')
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
        <div className="absolute right-[15%] top-[30%] h-32 w-32 rounded-full bg-secondary-fixed-dim/20 blur-3xl" />
        <div className="absolute bottom-[20%] left-[10%] h-64 w-64 rounded-full bg-primary-fixed-dim/20 blur-3xl" />
      </div>

      <main className="relative z-10 flex min-h-svh flex-col items-center justify-center px-6 py-12">
        <div className="mb-10 flex flex-col items-center">
          <div className="relative flex items-center justify-center px-10 py-8">
            <div className="organic-ripple absolute inset-0 border border-primary/20 opacity-40" />
            <AsarWordmark size="2xl" className="relative z-10 text-primary-emerald" />
          </div>
          <h1 className="font-headline text-xl font-semibold text-primary">Sign in</h1>
        </div>

        <form onSubmit={onSubmit} className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
          </div>
          <div>
            <label htmlFor="login-pass" className="mb-1 block text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Password
            </label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/25 bg-surface-container-lowest/80 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim"
            />
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-container px-8 py-4 text-sm font-semibold text-on-primary shadow-lg transition hover:opacity-95 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="mt-8 flex w-full max-w-md flex-col items-center gap-4">
          <Link
            to="/register"
            className="text-sm font-medium text-secondary hover:underline"
          >
            Create an account
          </Link>
          <Link
            to="/quran"
            className="group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-outline-variant/30 bg-surface-container-low/80 px-8 py-4 text-sm font-medium text-on-surface transition hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-xl text-secondary" aria-hidden>
              auto_stories
            </span>
            <span>Connect with Quran.com</span>
          </Link>
          <Link to="/" className="px-8 py-2 text-sm font-medium text-on-surface/70 hover:text-primary">
            Continue as guest
          </Link>
        </div>

        <footer className="absolute bottom-12 flex flex-col items-center space-y-2 opacity-40">
          <div className="mb-4 h-12 w-px bg-gradient-to-b from-transparent to-outline-variant" />
          <p className="font-label text-[10px] uppercase tracking-[0.2em]">ASAR Engine</p>
        </footer>
      </main>

      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03] mix-blend-multiply"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/natural-paper.png')",
        }}
      />
      <div className="pointer-events-none fixed inset-0 z-50 bg-gradient-to-t from-surface via-transparent to-transparent opacity-40" />
    </div>
  )
}
