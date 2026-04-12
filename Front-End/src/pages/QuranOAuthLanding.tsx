import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { wipeAsarSessionScopeFromBrowser } from '../lib/cleanSlate'
import { setAccessToken } from '../lib/authStorage'

/** Handles redirect from Back-End after Quran.com OAuth (`#asar_token=…`). */
export function QuranOAuthLanding() {
  const navigate = useNavigate()
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    const raw = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
    const params = new URLSearchParams(raw)
    const oauthErr = params.get('oauth_error')
    if (oauthErr) {
      setErr(oauthErr)
      return
    }
    const token = params.get('asar_token')
    if (!token) {
      setErr('missing_token')
      return
    }
    wipeAsarSessionScopeFromBrowser()
    setAccessToken(token)
    window.history.replaceState(null, '', window.location.pathname)
    navigate('/', { replace: true })
  }, [navigate])

  if (err) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-surface px-6 text-center">
        <p className="font-headline text-lg text-primary">Sign-in incomplete</p>
        <p className="mt-2 text-sm text-on-surface-variant">{err}</p>
        <button
          type="button"
          className="mt-6 rounded-full bg-primary px-6 py-2 text-sm font-semibold text-on-primary"
          onClick={() => navigate('/welcome', { replace: true })}
        >
          Back to welcome
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface text-on-surface-variant">
      Completing sign-in…
    </div>
  )
}
