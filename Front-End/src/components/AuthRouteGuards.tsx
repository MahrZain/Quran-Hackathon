import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

function AuthRouteSplash() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface text-sm text-on-surface/60">
      Checking session…
    </div>
  )
}

/** Welcome: skip entirely when already signed in. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <AuthRouteSplash />
  if (user) return <Navigate to="/" replace />
  return children
}

/** Main app: signed-in user only (Quran OAuth or demo JWT). */
export function RequireAppAccess() {
  const { user, loading } = useAuth()
  if (loading) return <AuthRouteSplash />
  if (user) return <Outlet />
  return <Navigate to="/welcome" replace />
}

/**
 * After auth, block shell routes until onboarding is complete.
 * `/onboarding` is a sibling route (not wrapped here).
 */
export function OnboardingGate() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <AuthRouteSplash />
  if (!user) return <Navigate to="/welcome" replace state={{ from: location }} />
  if (!user.onboarding_completed) {
    return <Navigate to="/onboarding" replace state={{ from: location }} />
  }
  return <Outlet />
}
