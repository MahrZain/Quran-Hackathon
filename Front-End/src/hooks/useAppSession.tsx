import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { SESSION_STORAGE_KEY } from '../lib/apiClient'

function readOrCreateSessionId(): string {
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
  const [sessionId] = useState(() => readOrCreateSessionId())

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
