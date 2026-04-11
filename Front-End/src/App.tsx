import { LazyMotion, domAnimation } from 'framer-motion'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/AppShell'
import { CommunityPage } from './pages/CommunityPage'
import { ConfigPage } from './pages/ConfigPage'
import { DashboardPage } from './pages/DashboardPage'
import { DhikrPage } from './pages/DhikrPage'
import { FocusPage } from './pages/FocusPage'
import { HabitsPage } from './pages/HabitsPage'
import { InsightsPage } from './pages/InsightsPage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { MentorPage } from './pages/MentorPage'
import { QuranListPage } from './pages/QuranListPage'
import { ReaderPage } from './pages/ReaderPage'
import { SettingsPage } from './pages/SettingsPage'
import { SupportPage } from './pages/SupportPage'
import { WelcomePage } from './pages/WelcomePage'

export function App() {
  return (
    <LazyMotion features={domAnimation} strict>
    <Routes>
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
        <Route path="/mentor" element={<MentorPage />} />
        <Route path="/insights" element={<InsightsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/config" element={<ConfigPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </LazyMotion>
  )
}
