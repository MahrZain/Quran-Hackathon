/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiClient } from '../lib/apiClient'
import type { TokenResponse, UserMe } from '../lib/apiTypes'
import { clearAccessToken, setAccessToken, getAccessToken } from '../lib/authStorage'

type AuthContextValue = {
  user: UserMe | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = getAccessToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }
    try {
      const { data } = await apiClient.get<UserMe>('/auth/me')
      setUser(data)
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

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<TokenResponse>('/auth/login', { email, password })
    setAccessToken(data.access_token)
    await refreshUser()
  }, [refreshUser])

  const register = useCallback(async (email: string, password: string) => {
    const { data } = await apiClient.post<TokenResponse>('/auth/register', { email, password })
    setAccessToken(data.access_token)
    await refreshUser()
  }, [refreshUser])

  const logout = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
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
