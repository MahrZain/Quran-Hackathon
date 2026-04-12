import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

import { useAuth } from '../context/AuthContext'
import { SESSION_STORAGE_KEY } from '../lib/apiClient'

function readOrCreateAnonymousSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(SESSION_STORAGE_KEY, id)
    }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

type AppSessionValue = {
  sessionId: string
}

const AppSessionContext = createContext<AppSessionValue | null>(null)

export function AppSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [sessionId, setSessionId] = useState(() => readOrCreateAnonymousSessionId())

  useEffect(() => {
    if (user?.asar_session_id) {
      const sid = user.asar_session_id
      try {
        if (localStorage.getItem(SESSION_STORAGE_KEY) !== sid) {
          localStorage.setItem(SESSION_STORAGE_KEY, sid)
        }
      } catch {
        /* ignore */
      }
      setSessionId(sid)
      return
    }
    setSessionId(readOrCreateAnonymousSessionId())
  }, [user?.asar_session_id, user?.id])

  const value = useMemo(() => ({ sessionId }), [sessionId])

  return <AppSessionContext.Provider value={value}>{children}</AppSessionContext.Provider>
}

export function useAppSession(): AppSessionValue {
  const ctx = useContext(AppSessionContext)
  if (!ctx) {
    throw new Error('useAppSession must be used within AppSessionProvider')
  }
  return ctx
}
