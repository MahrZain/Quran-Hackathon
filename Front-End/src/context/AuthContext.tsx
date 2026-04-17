/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apiClient, SESSION_STORAGE_KEY } from '../lib/apiClient'
import { ymdInTimeZone } from '../lib/ledgerCalendar'
import { wipeAsarSessionScopeFromBrowser } from '../lib/cleanSlate'
import { asarE2eTrace } from '../lib/asarE2eTrace'
import type { TokenResponse, UserMe } from '../lib/apiTypes'
import { clearAccessToken, setAccessToken, getAccessToken } from '../lib/authStorage'

type AuthContextValue = {
  user: UserMe | null
  loading: boolean
  /** One-tap signed-in demo (backend demo user). */
  loginDemo: () => Promise<void>
  /** Browser redirect to Quran Foundation OAuth (PKCE). */
  startQuranFoundationLogin: () => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEFAULT_LEDGER_TZ = 'Asia/Karachi'
const VISIBILITY_REFRESH_DEBOUNCE_MS = 400
const LEDGER_YMD_POLL_MS = 60_000

/** OAuth start must hit the same host as `QURAN_OAUTH_REDIRECT_URI` or the PKCE cookie is not sent on callback. */
function engineOriginForOAuthStart(): string {
  const explicit = (import.meta.env.VITE_ASAR_ENGINE_ORIGIN as string | undefined)?.trim()
  if (explicit) return explicit.replace(/\/$/, '')
  const api = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()
  if (api?.startsWith('http')) return api.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '')
  if (import.meta.env.DEV) return 'http://localhost:8000'
  return typeof window !== 'undefined' ? window.location.origin : ''
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null)
  /** No token → no /auth/me call; avoid a splash frame on public routes. */
  const [loading, setLoading] = useState(() => !!getAccessToken())
  const lastLedgerYmdRef = useRef<string | null>(null)

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await apiClient.get<UserMe>('/auth/me')
      setUser({
        ...data,
        onboarding_completed: Boolean(data.onboarding_completed),
      })
      try {
        if (data.asar_session_id) {
          localStorage.setItem(SESSION_STORAGE_KEY, data.asar_session_id)
        }
      } catch {
        /* ignore */
      }
    } catch {
      setUser(null)
      clearAccessToken()
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  /** Re-sync /auth/me when returning to the tab so ledger-day fields (e.g. ayahs_marked_today) refresh after midnight. */
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (!getAccessToken()) return
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void refreshUser()
      }, VISIBILITY_REFRESH_DEBOUNCE_MS)
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', scheduleRefresh)
    return () => {
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', scheduleRefresh)
    }
  }, [refreshUser])

  /** Long-lived focused tab: detect ledger civil day change (matches server today_in_ledger_tz). */
  useEffect(() => {
    if (!getAccessToken() || !user) {
      lastLedgerYmdRef.current = null
      return
    }
    const tz = (user.ledger_timezone ?? DEFAULT_LEDGER_TZ).trim() || DEFAULT_LEDGER_TZ

    const tick = () => {
      if (!getAccessToken()) return
      const ymd = ymdInTimeZone(new Date(), tz)
      const prev = lastLedgerYmdRef.current
      if (prev === null) {
        lastLedgerYmdRef.current = ymd
        return
      }
      if (ymd !== prev) {
        lastLedgerYmdRef.current = ymd
        if (prev !== null) {
          try {
            window.dispatchEvent(new CustomEvent('asar:ledger-day-changed', { detail: { ymd } }))
          } catch {
            /* ignore */
          }
        }
        void refreshUser()
      }
    }

    tick()
    const id = window.setInterval(tick, LEDGER_YMD_POLL_MS)
    return () => clearInterval(id)
  }, [user?.id, user?.ledger_timezone, refreshUser])

  const startQuranFoundationLogin = useCallback(() => {
    const base = engineOriginForOAuthStart()
    const startUrl = `${base}/api/v1/auth/quran/start`
    asarE2eTrace('STEP 1 — Continue with Quran.com: GET /api/v1/auth/quran/start', { startUrl })
    window.location.assign(startUrl)
  }, [])

  const loginDemo = useCallback(async () => {
    asarE2eTrace('STEP 1 — Try demo: POST /api/v1/auth/demo', {})

    const { data } = await apiClient.post<TokenResponse>('/auth/demo')

    setAccessToken(data.access_token)
    await refreshUser()
    let sessionId: string | null = null
    try {
      sessionId = localStorage.getItem(SESSION_STORAGE_KEY)
    } catch {
      sessionId = null
    }
    asarE2eTrace('STEP 1 — demo auth complete', {
      jwt_received: Boolean(data.access_token),
      expires_in: data.expires_in,
      session_id: sessionId,
    })
  }, [refreshUser])

  const logout = useCallback(() => {
    wipeAsarSessionScopeFromBrowser()
    clearAccessToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      loginDemo,
      startQuranFoundationLogin,
      logout,
      refreshUser,
    }),
    [user, loading, loginDemo, startQuranFoundationLogin, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
