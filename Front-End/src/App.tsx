import { LazyMotion, domAnimation } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import { OnboardingGate, RedirectIfAuthed, RequireAppAccess } from './components/AuthRouteGuards'
import { AppShell } from './layouts/AppShell'
import { ChatPage } from './pages/ChatPage'
import { CommunityPage } from './pages/CommunityPage'
import { ConfigPage } from './pages/ConfigPage'
import { DashboardPage } from './pages/DashboardPage'
import { DhikrPage } from './pages/DhikrPage'
import { FocusPage } from './pages/FocusPage'
import { HabitsPage } from './pages/HabitsPage'
import { InsightsPage } from './pages/InsightsPage'
import { LibraryPage } from './pages/LibraryPage'
import { MentorPage } from './pages/MentorPage'
import { QuranListPage } from './pages/QuranListPage'
import { ReaderPage } from './pages/ReaderPage'
import { SettingsPage } from './pages/SettingsPage'
import { SupportPage } from './pages/SupportPage'
import { QuranOAuthLanding } from './pages/QuranOAuthLanding'
import { OnboardingPage } from './pages/OnboardingPage'
import { WelcomePage } from './pages/WelcomePage'

export function App() {
  return (
    <LazyMotion features={domAnimation} strict>
    <Routes>
      <Route path="/welcome/oauth" element={<QuranOAuthLanding />} />
      <Route path="/login" element={<Navigate to="/welcome" replace />} />
      <Route path="/register" element={<Navigate to="/welcome" replace />} />
      <Route
        path="/welcome"
        element={
          <RedirectIfAuthed>
            <WelcomePage />
          </RedirectIfAuthed>
        }
      />
      <Route element={<RequireAppAccess />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<OnboardingGate />}>
          <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dhikr" element={<DhikrPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/quran" element={<QuranListPage />} />
          <Route path="/quran/:surahId" element={<ReaderPage />} />
          <Route path="/focus" element={<FocusPage />} />
          <Route path="/habits" element={<HabitsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/mentor" element={<MentorPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/config" element={<ConfigPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LazyMotion>
  )
}
