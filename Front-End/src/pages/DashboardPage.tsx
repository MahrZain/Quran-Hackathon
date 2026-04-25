import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DailyAyahBlock } from '../components/DailyAyahBlock'
import { DailyFlowRing } from '../components/DailyFlowRing'
import { StreakConstellation } from '../components/StreakConstellation'
import { useAuth } from '../context/AuthContext'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { StreakResponse, UserMe } from '../lib/apiTypes'
import { asarE2eTrace } from '../lib/asarE2eTrace'
import { dailyAyahFromVerseKey, fillSurahMeta, getDailyAyahFromTopicTag } from '../lib/mockData'
import { constellationDaysFromStreak } from '../lib/streakHelpers'
import { NotificationService } from '../lib/notificationService'

const heroImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDch2veucQKJt15pxGsoQodLhP-T_WKzVTPt0DM2Qc6zRU0fyQ1zjEeFD746Wyz3TtWE84yNaXYRLpFW4V0Q62ZKsHxNvfiMFfIQCHNvTRmyEjJuV47fAbOQk1HpBQYB654QbinS7Z6l733ybyiuBCoB861cYDkCM14WVnkKLdPtOfFwiYvNhVQHWpJ_4i2pTXy01G0qckvhP9v-BfETEqO62mGPCtiRt4KjQFf86ORT4eev4-jyaEVnucwajJiGFo80eSAr8qA93I'

const streakImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCpet3_At_K755v5oBSjznFncU8blzW4AT2DS7kvI6mXrSfeNjmRyXDUQV7v_G7A_XhO6-bywNe3taRFuQyFGttyNjkL_1V-i63cEiZbm-Jwpr9R5I8uSjc9bRlJ9XYb54qqix8hjuCsAax1Xz5vxVFiZcMBRdorynj4cOPtFHukTu3HAuDrlgnTV5kywsllh0k0bSx5-HD__0wzdVYRISTLA9AsH11LqeCmrWbNIvqPjz1J2Bk_IRDY_q9DqFIb-9N7YyAUL-3P78'

export function DashboardPage() {
  const { user, refreshUser } = useAuth()
  const {
    displayAyah,
    setDisplayAyah,
    streakCount,
    syncStreakCount,
    sessionUserMessages,
    sessionTotalMessages,
    refreshSessionChatStats,
    ayahsMarkedToday,
    syncAyahsMarkedToday,
  } = useMoodAyah()
  const { sessionId } = useAppSession()
  const [constellationDays, setConstellationDays] = useState(() => constellationDaysFromStreak(0))
  const [markLoading, setMarkLoading] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [markSaved, setMarkSaved] = useState(false)
  const [qfToast, setQfToast] = useState(false)
  const [streakUnchangedHint, setStreakUnchangedHint] = useState(false)
  const [scopeEndHint, setScopeEndHint] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)
  const markSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qfToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streakHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Ring: streak continuity (up to ~55%) plus āyāt marked today (up to ~55%), capped at 100%.
   * Same-day extra marks grow the ring without faking streak days.
   */
  const flowPercent = Math.min(
    100,
    Math.round(
      (streakCount === 0 ? 0 : Math.min(55, 10 + streakCount * 9)) + Math.min(55, ayahsMarkedToday * 14),
    ),
  )
  const engagementPoints = sessionUserMessages * 12 + streakCount * 20 + ayahsMarkedToday * 8

  const displayVerseKey = `${displayAyah.surahId}:${displayAyah.ayahNumber}`
  const alignedWithServerCursor =
    Boolean(user?.onboarding_completed && user?.current_verse_key === displayVerseKey)
  const atScopeLimit =
    Boolean(user?.at_reading_scope_end) && alignedWithServerCursor
  const isSingleSurahScope = user?.reading_scope === 'single_surah'

  const streakSubtitle =
    streakCount === 0
      ? 'Start your streak'
      : streakCount === 1
        ? '1 day streak'
        : `${streakCount} day streak`

  useEffect(() => {
    setConstellationDays(constellationDaysFromStreak(streakCount))
  }, [streakCount])

  useEffect(() => {
    // Only notify if user is logged in and today is 0
    if (user && ayahsMarkedToday === 0) {
      void NotificationService.checkAndNotify(ayahsMarkedToday)
    }
  }, [user, ayahsMarkedToday])

  useEffect(() => {
    return () => {
      if (markSavedTimerRef.current) clearTimeout(markSavedTimerRef.current)
      if (qfToastTimerRef.current) clearTimeout(qfToastTimerRef.current)
      if (streakHintTimerRef.current) clearTimeout(streakHintTimerRef.current)
    }
  }, [])

  const onMarkComplete = useCallback(async () => {
    setMarkError(null)
    setMarkSaved(false)
    setStreakUnchangedHint(false)
    setScopeEndHint(false)
    setMarkLoading(true)
    const countBefore = streakCount
    const ayah_read = `${displayAyah.surahId}:${displayAyah.ayahNumber}`
    try {
      asarE2eTrace('STEP 4 — POST /streak (Mark complete)', { session_id: sessionId, ayah_read })
      const { data } = await apiClient.post<StreakResponse>('/streak', {
        session_id: sessionId,
        ayah_read,
      })
      syncStreakCount(data.updated_streak_count)
      setStreakUnchangedHint(data.updated_streak_count === countBefore)
      if (typeof data.ayahs_marked_today === 'number') {
        syncAyahsMarkedToday(data.ayahs_marked_today)
      }
      if (data.next_verse_key && /^\d+:\d+$/.test(data.next_verse_key)) {
        setDisplayAyah(fillSurahMeta(dailyAyahFromVerseKey(data.next_verse_key)))
      }
      setScopeEndHint(Boolean(data.at_scope_end))
      void refreshSessionChatStats()
      void refreshUser()
      asarE2eTrace('STEP 4 — streak logged (SQLite streak_activities)', {
        ok: data.ok,
        updated_streak_count: data.updated_streak_count,
        quran_foundation_synced: data.quran_foundation_synced,
      })
      window.dispatchEvent(new CustomEvent('asar:ledger-refresh'))
      setMarkSaved(true)
      if (data.quran_foundation_synced) {
        setQfToast(true)
        if (qfToastTimerRef.current) clearTimeout(qfToastTimerRef.current)
        qfToastTimerRef.current = setTimeout(() => {
          setQfToast(false)
          qfToastTimerRef.current = null
        }, 5000)
      }
      if (markSavedTimerRef.current) clearTimeout(markSavedTimerRef.current)
      markSavedTimerRef.current = setTimeout(() => {
        setMarkSaved(false)
        markSavedTimerRef.current = null
      }, 3500)
      if (streakHintTimerRef.current) clearTimeout(streakHintTimerRef.current)
      streakHintTimerRef.current = setTimeout(() => {
        setStreakUnchangedHint(false)
        streakHintTimerRef.current = null
      }, 6000)
    } catch {
      setMarkError('Could not sync your reading progress. Please try again.')
    } finally {
      setMarkLoading(false)
    }
  }, [
    displayAyah.ayahNumber,
    displayAyah.surahId,
    sessionId,
    streakCount,
    syncStreakCount,
    syncAyahsMarkedToday,
    setDisplayAyah,
    refreshSessionChatStats,
    refreshUser,
  ])

  const onRestartReading = useCallback(async () => {
    setMarkError(null)
    setRestartLoading(true)
    try {
      const { data } = await apiClient.post<UserMe>('/auth/me/reading-restart')
      if (data.current_verse_key && /^\d+:\d+$/.test(data.current_verse_key)) {
        setDisplayAyah(fillSurahMeta(dailyAyahFromVerseKey(data.current_verse_key)))
      }
      await refreshUser()
    } catch {
      setMarkError('Could not restart reading. Please try again.')
    } finally {
      setRestartLoading(false)
    }
  }, [refreshUser, setDisplayAyah])

  return (
    <div className="relative mx-auto max-w-7xl">
      {qfToast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[100] max-w-md -translate-x-1/2 rounded-2xl bg-primary px-5 py-3 text-center text-sm font-semibold text-on-primary shadow-ambient"
        >
          ✅ Activity successfully synced to Quran Foundation.
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-12 md:items-stretch">
        {/* Daily ASAR — same row + height as Ayah on desktop */}
        <div className="relative flex min-h-[28rem] flex-col items-center justify-between overflow-hidden rounded-stitch bg-surface-container-lowest p-8 sm:p-10 md:col-span-5 md:min-h-[32rem]">
          <div className="pointer-events-none absolute inset-0 opacity-5">
            <img src={heroImg} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="relative z-10 flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
            <h2 className="font-headline text-2xl font-bold tracking-tight text-primary sm:text-3xl">
              Daily ASAR
            </h2>
            <p className="mt-3 max-w-xs text-center text-[11px] leading-snug text-on-surface-variant/75">
              {atScopeLimit
                ? isSingleSurahScope
                  ? 'End of this surah — tap Start again for āyah 1.'
                  : 'End of the Qur’an — tap Start again from Al-Fātiḥah.'
                : 'Mark complete updates your streak and moves to the next āyah.'}
            </p>
            <div className="relative mt-8 flex h-56 w-56 shrink-0 items-center justify-center sm:mt-10 sm:h-72 sm:w-72">
              <div className="absolute inset-0 rounded-full border-[14px] border-surface-container opacity-50 sm:border-[18px]" />
              <div className="absolute inset-[-8%] rounded-full liquid-halo opacity-45" />
              <div className="absolute inset-0 flex items-center justify-center">
                <DailyFlowRing percent={flowPercent} />
              </div>
              <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center text-center">
                <span className="font-headline text-6xl font-black tabular-nums tracking-tight text-primary sm:text-7xl">
                  {flowPercent}
                  <span className="text-2xl font-bold text-secondary sm:text-3xl">%</span>
                </span>
              </div>
            </div>
            <div className="relative z-10 mt-4 flex w-full max-w-xs flex-col items-center gap-2">
              {atScopeLimit ? (
                <>
                  <p className="w-full rounded-2xl border border-outline-variant/20 bg-surface-container-high/40 px-4 py-2 text-center text-xs font-semibold text-on-surface-variant">
                    {isSingleSurahScope ? 'End of this surah' : 'End of the Qur’an'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void onRestartReading()}
                    disabled={restartLoading}
                    className="w-full rounded-full bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary shadow-lg transition hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                  >
                    {restartLoading
                      ? 'Restarting…'
                      : isSingleSurahScope
                        ? user?.reading_scope_surah != null
                          ? `Start again — surah ${user.reading_scope_surah} · āyah 1`
                          : 'Start again from āyah 1'
                        : 'Start again from Al-Fātiḥah (1:1)'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => void onMarkComplete()}
                  disabled={markLoading}
                  className="w-full rounded-full bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary shadow-lg transition hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
                >
                  {markLoading ? 'Saving…' : markSaved ? 'Saved for today' : 'Mark complete'}
                </button>
              )}
              {markError && <p className="text-center text-xs text-error">{markError}</p>}
              {markSaved && !markLoading && !markError && (
                <p
                  className={`text-center text-xs leading-snug ${
                    streakUnchangedHint ? 'text-on-surface-variant' : 'font-medium text-primary/90'
                  }`}
                >
                  {scopeEndHint ? (
                    <>Saved — at end of reading scope; streak counted.</>
                  ) : streakUnchangedHint ? (
                    <>Saved — same day streak; card advanced to next āyah.</>
                  ) : (
                    <>Saved — streak updated.</>
                  )}
                </p>
              )}
              {user?.onboarding_topic_tag ? (
                <button
                  type="button"
                  className="mt-1 text-center text-xs font-semibold text-secondary hover:underline"
                  onClick={() => setDisplayAyah(getDailyAyahFromTopicTag(user.onboarding_topic_tag!))}
                >
                  Load an āyah for my theme ({user.onboarding_topic_tag})
                </button>
              ) : null}
              <Link
                prefetch="viewport"
                to={`/quran/${displayAyah.surahId}?ayah=${displayAyah.ayahNumber}`}
                className="mt-2 text-center text-xs font-semibold text-primary/85 hover:text-primary hover:underline"
              >
                Open in reader · {fillSurahMeta(displayAyah).surahName} {displayAyah.surahId}:{displayAyah.ayahNumber}
              </Link>
            </div>
          </div>
          <div className="relative z-10 mt-8 grid w-full grid-cols-2 gap-6 text-center sm:mt-10 sm:gap-8">
            <div>
              <div className="text-lg font-bold text-secondary sm:text-xl">{sessionUserMessages}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Heart check-ins
              </div>
            </div>
            <div>
              <div className="text-lg font-bold text-secondary sm:text-xl">{sessionTotalMessages}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Session turns
              </div>
            </div>
          </div>
        </div>

        <DailyAyahBlock ayah={displayAyah} className="md:col-span-7 md:min-h-[32rem]" />

        <Link
          to="/habits"
          className="relative block overflow-visible rounded-stitch bg-[#001c15] p-6 transition hover:brightness-110 sm:p-8 md:col-span-7 md:col-start-6"
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-stitch opacity-40">
            <img src={streakImg} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="font-headline text-lg font-bold text-emerald-50 sm:text-xl">
                  Streak Constellation
                </h3>
                <p className="mt-1 text-xs font-medium uppercase tracking-widest text-emerald-400/60">
                  {streakSubtitle}
                </p>
              </div>
              <span className="material-symbols-outlined text-3xl text-secondary" aria-hidden>
                stars
              </span>
            </div>
            <StreakConstellation days={constellationDays} />
            <div className="mt-4 flex items-end justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/40">
                Last 30 days
              </span>
              <div className="text-right">
                <span className="text-2xl font-black text-secondary">{engagementPoints}</span>
                <span className="ml-1 text-xs font-medium uppercase text-emerald-400/60">
                  Engagement
                </span>
                <p className="mt-0.5 max-w-[11rem] text-[9px] leading-tight text-emerald-500/50">
                  Streak, marks today, and companion chat.
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
