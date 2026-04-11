import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { DailyAyahBlock } from '../components/DailyAyahBlock'
import { DailyFlowRing } from '../components/DailyFlowRing'
import { StreakConstellation } from '../components/StreakConstellation'
import { useMoodAyah } from '../context/MoodAyahContext'
import { useAppSession } from '../hooks/useAppSession'
import { apiClient } from '../lib/apiClient'
import type { StreakResponse, StreakSnapshot } from '../lib/apiTypes'
import { asarE2eTrace } from '../lib/asarE2eTrace'
import { constellationDaysFromStreak } from '../lib/streakHelpers'

const heroImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDch2veucQKJt15pxGsoQodLhP-T_WKzVTPt0DM2Qc6zRU0fyQ1zjEeFD746Wyz3TtWE84yNaXYRLpFW4V0Q62ZKsHxNvfiMFfIQCHNvTRmyEjJuV47fAbOQk1HpBQYB654QbinS7Z6l733ybyiuBCoB861cYDkCM14WVnkKLdPtOfFwiYvNhVQHWpJ_4i2pTXy01G0qckvhP9v-BfETEqO62mGPCtiRt4KjQFf86ORT4eev4-jyaEVnucwajJiGFo80eSAr8qA93I'

const streakImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCpet3_At_K755v5oBSjznFncU8blzW4AT2DS7kvI6mXrSfeNjmRyXDUQV7v_G7A_XhO6-bywNe3taRFuQyFGttyNjkL_1V-i63cEiZbm-Jwpr9R5I8uSjc9bRlJ9XYb54qqix8hjuCsAax1Xz5vxVFiZcMBRdorynj4cOPtFHukTu3HAuDrlgnTV5kywsllh0k0bSx5-HD__0wzdVYRISTLA9AsH11LqeCmrWbNIvqPjz1J2Bk_IRDY_q9DqFIb-9N7YyAUL-3P78'

export function DashboardPage() {
  const { displayAyah, streakCount, syncStreakCount, sessionUserMessages, sessionTotalMessages } = useMoodAyah()
  const { sessionId } = useAppSession()
  const [constellationDays, setConstellationDays] = useState(() => constellationDaysFromStreak(0))
  const [markLoading, setMarkLoading] = useState(false)
  const [markError, setMarkError] = useState<string | null>(null)
  const [markSaved, setMarkSaved] = useState(false)
  const [qfToast, setQfToast] = useState(false)
  const markSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const qfToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flowPercent = Math.min(100, Math.round(18 + streakCount * 12))
  const engagementPoints = sessionUserMessages * 12 + streakCount * 20
  const streakSubtitle =
    streakCount === 0
      ? 'Start your streak'
      : streakCount === 1
        ? '1 day streak'
        : `${streakCount} day streak`

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        asarE2eTrace('STEP 5 — GET /streak/{session_id} (chat counts from MoodAyah /history)', {
          session_id: sessionId,
        })
        const { data: streakRes } = await apiClient.get<StreakSnapshot>(`/streak/${sessionId}`)
        if (cancelled) return
        syncStreakCount(streakRes.updated_streak_count)
        asarE2eTrace('STEP 5 — streak hydrated from DB', {
          updated_streak_count: streakRes.updated_streak_count,
          daily_flow_ring_percent: Math.min(100, Math.round(18 + streakRes.updated_streak_count * 12)),
        })
      } catch (e) {
        if (!cancelled) {
          asarE2eTrace('STEP 5 — hydrate failed (API down or unauthorized)', { error: String(e) })
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [sessionId, syncStreakCount])

  useEffect(() => {
    setConstellationDays(constellationDaysFromStreak(streakCount))
  }, [streakCount])

  useEffect(() => {
    return () => {
      if (markSavedTimerRef.current) clearTimeout(markSavedTimerRef.current)
      if (qfToastTimerRef.current) clearTimeout(qfToastTimerRef.current)
    }
  }, [])

  const onMarkComplete = useCallback(async () => {
    setMarkError(null)
    setMarkSaved(false)
    setMarkLoading(true)
    const ayah_read = `${displayAyah.surahId}:${displayAyah.ayahNumber}`
    try {
      asarE2eTrace('STEP 4 — POST /streak (Mark complete)', { session_id: sessionId, ayah_read })
      const { data } = await apiClient.post<StreakResponse>('/streak', {
        session_id: sessionId,
        ayah_read,
      })
      syncStreakCount(data.updated_streak_count)
      asarE2eTrace('STEP 4 — streak logged (SQLite streak_activities)', {
        ok: data.ok,
        updated_streak_count: data.updated_streak_count,
        quran_foundation_synced: data.quran_foundation_synced,
      })
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
    } catch {
      setMarkError('Could not log streak. Is the ASAR Engine running on port 8000?')
    } finally {
      setMarkLoading(false)
    }
  }, [displayAyah.ayahNumber, displayAyah.surahId, sessionId, syncStreakCount])

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
            <p className="mt-2 text-xs font-medium uppercase tracking-widest text-on-surface-variant opacity-60">
              Heart Alignment
            </p>
            <p className="mt-3 max-w-xs text-center text-[11px] leading-snug text-on-surface-variant/75">
              Log today&apos;s reading for your streak. You can tap again if your focus verse changes.
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
                <div className="mt-2 text-xs font-bold uppercase tracking-widest text-primary/90">
                  Fulfilled
                </div>
              </div>
            </div>
            <div className="relative z-10 mt-4 flex w-full max-w-xs flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void onMarkComplete()}
                disabled={markLoading}
                className="w-full rounded-full bg-gradient-to-r from-primary to-primary-container px-5 py-3 text-sm font-semibold text-on-primary shadow-lg transition hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
              >
                {markLoading ? 'Saving…' : markSaved ? 'Saved for today' : 'Mark complete'}
              </button>
              {markError && <p className="text-center text-xs text-error">{markError}</p>}
              {markSaved && !markLoading && !markError && (
                <p className="text-center text-xs font-medium text-primary/90">Streak updated in your ledger.</p>
              )}
              <Link
                to={`/quran/${displayAyah.surahId}?ayah=${displayAyah.ayahNumber}`}
                className="mt-2 text-center text-xs font-semibold text-primary/85 hover:text-primary hover:underline"
              >
                Open in reader · {displayAyah.surahName} {displayAyah.surahId}:{displayAyah.ayahNumber}
              </Link>
            </div>
          </div>
          <div className="relative z-10 mt-8 grid w-full grid-cols-2 gap-6 text-center sm:mt-10 sm:gap-8">
            <div>
              <div className="text-lg font-bold text-secondary sm:text-xl">{sessionUserMessages}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Heart check-ins
              </div>
              <p className="mt-1 text-[10px] leading-snug text-on-surface-variant/80">Mood messages you sent ASAR</p>
            </div>
            <div>
              <div className="text-lg font-bold text-secondary sm:text-xl">{sessionTotalMessages}</div>
              <div className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
                Session turns
              </div>
              <p className="mt-1 text-[10px] leading-snug text-on-surface-variant/80">Total chat rows this session</p>
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
                Last 7 days
              </span>
              <div className="text-right">
                <span className="text-2xl font-black text-secondary">{engagementPoints}</span>
                <span className="ml-1 text-xs font-medium uppercase text-emerald-400/60">
                  Engagement
                </span>
                <p className="mt-0.5 max-w-[10rem] text-[9px] leading-tight text-emerald-500/50">
                  From streak + heart check-ins (this session)
                </p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
