import { m } from 'framer-motion'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AsarWordmark } from '../components/AsarWordmark'
import { MoodCompassBar } from '../components/MoodCompassBar'
import { MoodAyahProvider } from '../context/MoodAyahContext'
import { useAuth } from '../context/AuthContext'
import { AppSessionProvider } from '../hooks/useAppSession'

const sideNav = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/dhikr', label: 'Daily Dhikr', icon: 'potted_plant', end: false },
  { to: '/quran', label: 'Quran progress', icon: 'menu_book', end: false },
  { to: '/library', label: 'Library', icon: 'local_library', end: false },
] as const

/** Desktop: every Stitch screen with a route is reachable without typing URLs. */
const sideNavMore = [
  { to: '/focus', label: 'Focus — Ayah', icon: 'center_focus_strong', end: false },
  { to: '/chat', label: 'Quran companion', icon: 'chat', end: false },
  { to: '/insights', label: 'AI Insight Results', icon: 'auto_awesome', end: false },
  { to: '/habits', label: 'Habit ledger', icon: 'stars', end: false },
  { to: '/config', label: 'Sanctuary configuration', icon: 'tune', end: false },
] as const

function Icon({ name }: { name: string }) {
  return (
    <span className="material-symbols-outlined" aria-hidden>
      {name}
    </span>
  )
}

function AppShellInner() {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()

  const chatLayout = location.pathname === '/chat'

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-surface text-on-surface">
      <header className="asar-glass fixed top-0 z-50 flex h-20 w-full items-center px-4 shadow-ambient sm:px-6">
        <div className="flex w-28 shrink-0 items-center sm:w-36">
          <NavLink
            to="/"
            className="flex items-center transition-opacity hover:opacity-90"
            aria-label="Home — ASAR"
          >
            <AsarWordmark size="sm" className="text-primary-emerald" aria-hidden />
          </NavLink>
        </div>

        <div className="pointer-events-none absolute inset-x-0 flex justify-center px-2 sm:px-28 md:px-40">
          <div className="pointer-events-auto w-full max-w-xl px-2">
            <MoodCompassBar />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-6">
          <NavLink
            to="/settings"
            className="text-primary transition-transform active:scale-95"
            aria-label="Account"
          >
            <Icon name="account_circle" />
          </NavLink>
          <NavLink
            to="/settings"
            className="text-primary transition-transform active:scale-95"
            aria-label="Settings"
          >
            <Icon name="settings" />
          </NavLink>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden pt-20">
        <aside className="fixed bottom-0 left-0 top-20 z-20 hidden w-64 flex-col overflow-y-auto overscroll-contain bg-surface py-6 lg:flex">
          <div className="flex-1 space-y-1 px-0 pt-1">
            {sideNav.map(({ to, label, icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `mx-2 flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200 hover:translate-x-1 ${
                    isActive
                      ? 'bg-emerald-100/50 text-primary'
                      : 'text-primary/70 hover:bg-emerald-50'
                  }`
                }
              >
                <Icon name={icon} />
                <span className="text-sm font-medium">{label}</span>
              </NavLink>
            ))}
          </div>

          <div className="mt-6 border-t border-outline-variant/10 px-2 pt-5">
            <p className="mb-2 px-4 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant opacity-60">
              Reflection &amp; tools
            </p>
            <div className="space-y-1">
              {sideNavMore.map(({ to, label, icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    `mx-2 flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-200 hover:translate-x-1 ${
                      isActive
                        ? 'bg-emerald-100/50 text-primary'
                        : 'text-primary/70 hover:bg-emerald-50'
                    }`
                  }
                >
                  <Icon name={icon} />
                  <span className="text-sm font-medium">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          <div className="mt-auto px-6">
            <NavLink
              to="/dhikr"
              className="block w-full rounded-full bg-gradient-to-r from-primary to-primary-container py-4 text-center text-sm font-medium tracking-wide text-on-primary shadow-lg transition-all hover:shadow-primary-soft"
            >
              Start Dhikr
            </NavLink>
            <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] text-primary/55">
              <NavLink to="/" end className="hover:text-primary hover:underline">
                Welcome
              </NavLink>
              <span aria-hidden className="text-on-surface-variant">
                ·
              </span>
              <button
                type="button"
                className="cursor-pointer bg-transparent p-0 font-inherit text-[11px] text-primary/55 hover:text-primary hover:underline"
                onClick={() => {
                  logout()
                  navigate('/welcome', { replace: true })
                }}
              >
                Sign out
              </button>
            </div>
            <div className="mt-8 space-y-2 border-t border-outline-variant/10 pb-4 pt-6">
              <NavLink
                to="/settings"
                className="flex items-center gap-3 text-sm text-primary/70 hover:text-primary"
              >
                <Icon name="settings" />
                Settings
              </NavLink>
              <NavLink
                to="/support"
                className="flex items-center gap-3 text-sm text-primary/70 hover:text-primary"
              >
                <Icon name="help" />
                Support
              </NavLink>
            </div>
          </div>
        </aside>

        <m.main
          key={location.pathname}
          className={`min-h-0 flex-1 bg-surface lg:ml-64 ${
            chatLayout
              ? 'flex flex-col overflow-hidden p-0 sm:p-4 lg:pb-8'
              : 'overflow-y-auto overflow-x-hidden p-4 pb-24 sm:p-8 lg:pb-8'
          }`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          <Outlet />
        </m.main>
      </div>


      <nav
        className="fixed bottom-0 left-0 z-40 flex h-20 w-full items-center justify-around border-t border-outline-variant/10 bg-white/90 px-2 backdrop-blur-lg lg:hidden"
        aria-label="Primary"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface/40'}`
          }
        >
          <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            dashboard
          </span>
          <span className="text-[10px] font-bold uppercase">Home</span>
        </NavLink>
        <NavLink
          to="/dhikr"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface/40'}`
          }
        >
          <Icon name="potted_plant" />
          <span className="text-[10px] font-bold uppercase">Dhikr</span>
        </NavLink>
        {!chatLayout && (
          <div className="relative -top-8">
            <NavLink
              to="/chat"
              className="flex rounded-full bg-primary p-4 text-on-primary shadow-2xl shadow-primary/40 ring-8 ring-surface transition-transform hover:scale-110 active:scale-95"
              aria-label="Open Quran companion"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </NavLink>
          </div>
        )}
        <NavLink
          to="/quran"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface/40'}`
          }
        >
          <Icon name="menu_book" />
          <span className="text-[10px] font-bold uppercase">Quran</span>
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 ${isActive ? 'text-primary' : 'text-on-surface/40'}`
          }
        >
          <Icon name="account_circle" />
          <span className="text-[10px] font-bold uppercase">Profile</span>
        </NavLink>
      </nav>
    </div>
  )
}

export function AppShell() {
  const { user } = useAuth()
  return (
    <AppSessionProvider>
      <MoodAyahProvider key={user ? `u-${user.id}` : 'anon'}>
        <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
          <AppShellInner />
        </div>
      </MoodAyahProvider>
    </AppSessionProvider>
  )
}
