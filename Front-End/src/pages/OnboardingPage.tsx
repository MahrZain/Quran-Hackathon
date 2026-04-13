import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SurahAyahPicker, verseCountForSurah } from '../components/SurahAyahPicker'
import { Button } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../lib/apiClient'
import type { ChapterSummary, OnboardingCompletePayload, UserMe } from '../lib/apiTypes'
import { apiErrorMessage } from '../lib/apiErrors'

type StepKey = 'level' | 'intent' | 'scope' | 'start' | 'done'

type LevelId = 'beginner' | 'intermediate' | 'daily_learner'
type IntentId = 'habit' | 'reading'
type ScopeId = 'full_mushaf' | 'single_surah'
type StartId = 'beginning' | 'custom'

const LEVELS: { id: LevelId; title: string; blurb: string }[] = [
  { id: 'beginner', title: 'Beginner', blurb: 'Short, gentle steps — build confidence first.' },
  { id: 'intermediate', title: 'Intermediate', blurb: 'You read sometimes; we’ll keep momentum steady.' },
  { id: 'daily_learner', title: 'Daily learner', blurb: 'One āyah after another through your chosen path.' },
]

const INTENTS: { id: IntentId; title: string; blurb: string }[] = [
  { id: 'habit', title: 'Habit building', blurb: 'Small daily wins — streaks and consistency at your pace.' },
  { id: 'reading', title: 'Daily reading', blurb: 'Move through the Qur’an step by step from where you choose.' },
]

function choiceCardClass(selected: boolean) {
  return `w-full rounded-2xl border px-4 py-4 text-left transition ${
    selected
      ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
      : 'border-outline-variant/25 bg-surface-container-low/40 hover:border-primary/35'
  }`
}

export function OnboardingPage() {
  const { user, loading, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditMode = location.pathname === '/settings/reading'

  const [level, setLevel] = useState<LevelId | null>(null)
  const [intent, setIntent] = useState<IntentId | null>(null)
  const [readingScope, setReadingScope] = useState<ScopeId | null>(null)
  const [scopeSurah, setScopeSurah] = useState<number | null>(null)
  const [startLocation, setStartLocation] = useState<StartId | null>(null)
  const [customSurah, setCustomSurah] = useState('')
  const [customAyah, setCustomAyah] = useState('1')
  const [chapters, setChapters] = useState<ChapterSummary[] | null>(null)
  const [chaptersErr, setChaptersErr] = useState<string | null>(null)

  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const prefilledRef = useRef(false)

  const steps = useMemo((): StepKey[] => ['level', 'intent', 'scope', 'start', 'done'], [])

  useEffect(() => {
    if (!loading && user?.onboarding_completed && !isEditMode) {
      navigate('/', { replace: true })
    }
  }, [loading, user?.onboarding_completed, navigate, isEditMode])

  useEffect(() => {
    let cancelled = false
    void apiClient
      .get<ChapterSummary[]>('/chapters')
      .then(({ data }) => {
        if (!cancelled && data?.length) setChapters(data)
      })
      .catch(() => {
        if (!cancelled) {
          setChaptersErr('Could not load surah list; enter surah numbers manually.')
          setChapters(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isEditMode || !user?.onboarding_completed || loading || prefilledRef.current) return
    prefilledRef.current = true
    const g = (user.onboarding_goal || 'habit').toLowerCase()
    setIntent(g === 'reading' ? 'reading' : 'habit')
    let lv = (user.onboarding_level || 'beginner').toLowerCase()
    if (lv === 'regular') lv = 'daily_learner'
    if (lv === 'beginner' || lv === 'intermediate' || lv === 'daily_learner') {
      setLevel(lv as LevelId)
    } else {
      setLevel('beginner')
    }
    const rs = (user.reading_scope || 'full_mushaf').toLowerCase()
    const scope: ScopeId = rs === 'single_surah' ? 'single_surah' : 'full_mushaf'
    setReadingScope(scope)
    setScopeSurah(user.reading_scope_surah ?? null)

    const key = user.current_verse_key || user.recommended_verse_key || ''
    const parts = key.split(':')
    const si = Number(parts[0])
    const ai = Number(parts[1])
    const ss = user.reading_scope_surah
    const atBeginning =
      Number.isFinite(si) &&
      Number.isFinite(ai) &&
      ((scope !== 'single_surah' && si === 1 && ai === 1) ||
        (scope === 'single_surah' && ss != null && si === ss && ai === 1))
    if (atBeginning) {
      setStartLocation('beginning')
    } else if (Number.isFinite(si) && Number.isFinite(ai)) {
      setStartLocation('custom')
      setCustomSurah(String(si))
      setCustomAyah(String(ai))
    } else {
      setStartLocation('beginning')
    }
  }, [isEditMode, user, loading])

  const currentStep = steps[stepIndex] ?? 'level'

  const customSurahNum = Number(customSurah)
  const customAyahNum = Number(customAyah)
  const maxAyahCustom = verseCountForSurah(chapters, customSurahNum) ?? 286

  const canAdvance = useMemo(() => {
    if (currentStep === 'level') return level !== null
    if (currentStep === 'intent') return intent !== null
    if (currentStep === 'scope') {
      if (!readingScope) return false
      if (readingScope === 'single_surah') return scopeSurah !== null && scopeSurah >= 1 && scopeSurah <= 114
      return true
    }
    if (currentStep === 'start') {
      if (!startLocation) return false
      if (startLocation === 'custom') {
        if (!Number.isFinite(customSurahNum) || customSurahNum < 1 || customSurahNum > 114) return false
        if (!Number.isFinite(customAyahNum) || customAyahNum < 1) return false
        if (customAyahNum > maxAyahCustom) return false
        if (readingScope === 'single_surah' && scopeSurah !== null && customSurahNum !== scopeSurah) return false
        return true
      }
      return true
    }
    return false
  }, [
    currentStep,
    level,
    intent,
    readingScope,
    scopeSurah,
    startLocation,
    customSurahNum,
    customAyahNum,
    maxAyahCustom,
  ])

  const handleContinue = useCallback(() => {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }, [steps.length])

  const goBack = useCallback(() => {
    setErr(null)
    setStepIndex((i) => (i <= 0 ? 0 : i - 1))
  }, [])

  const submit = useCallback(async () => {
    if (!level || !intent || !readingScope || !startLocation) return
    if (readingScope === 'single_surah' && scopeSurah === null) return

    let start_surah: number | undefined
    let start_ayah: number | undefined
    const scope_surah = readingScope === 'single_surah' ? scopeSurah! : undefined

    if (startLocation === 'beginning') {
      start_surah = undefined
      start_ayah = undefined
    } else {
      start_surah = customSurahNum
      start_ayah = customAyahNum
    }

    const payload: OnboardingCompletePayload = {
      goal: intent,
      level,
      reading_scope: readingScope,
      start_location: startLocation,
      start_surah: startLocation === 'custom' ? start_surah : undefined,
      start_ayah: startLocation === 'custom' ? start_ayah : undefined,
      scope_surah: readingScope === 'single_surah' ? scope_surah : undefined,
    }

    setErr(null)
    setSubmitting(true)
    try {
      await apiClient.patch<UserMe>('/auth/me/onboarding', payload)
      await refreshUser()
      navigate(isEditMode ? '/settings' : '/', { replace: true })
    } catch (e) {
      setErr(apiErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }, [
    level,
    intent,
    readingScope,
    scopeSurah,
    startLocation,
    customSurahNum,
    customAyahNum,
    refreshUser,
    navigate,
    isEditMode,
  ])

  const progress = Math.round(((stepIndex + 1) / steps.length) * 100)

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-surface text-sm text-on-surface/60">
        Loading your profile…
      </div>
    )
  }

  return (
    <div className="relative flex min-h-svh flex-col bg-surface text-on-surface">
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-primary-fixed-dim/15 via-surface to-surface" />
      <header className="relative z-10 border-b border-outline-variant/10 px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex shrink-0 items-center">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-semibold text-secondary transition hover:bg-surface-container-low hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                Back
              </button>
            ) : isEditMode ? (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-sm font-semibold text-secondary transition hover:bg-surface-container-low hover:text-primary"
              >
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
                Settings
              </button>
            ) : (
              <span className="inline-block w-[4.5rem]" aria-hidden />
            )}
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <span className="shrink-0 text-xs font-medium text-on-surface-variant">
              {stepIndex + 1}/{steps.length}
            </span>
          </div>
        </div>
        {isEditMode && (
          <p className="mx-auto mt-2 max-w-lg px-4 text-center text-xs text-on-surface-variant sm:px-8">
            Reading preferences — saving updates your path and moves your cursor to the start you choose.
          </p>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:px-8">
        {currentStep === 'level' && (
          <>
            <h1 className="font-headline text-2xl font-bold text-primary">Your level</h1>
            <p className="mt-2 text-sm text-on-surface/65">We’ll match pacing and how the dashboard advances.</p>
            <div className="mt-8 flex flex-col gap-3">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={choiceCardClass(level === l.id)}
                  onClick={() => setLevel(l.id)}
                >
                  <span className="font-semibold text-on-surface">{l.title}</span>
                  <p className="mt-1 text-xs text-on-surface/60">{l.blurb}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {currentStep === 'intent' && (
          <>
            <h1 className="font-headline text-2xl font-bold text-primary">What’s your focus?</h1>
            <p className="mt-2 text-sm text-on-surface/65">Habit vs reading changes how we describe your flow — both use Mark complete to move forward.</p>
            <div className="mt-8 flex flex-col gap-3">
              {INTENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className={choiceCardClass(intent === g.id)}
                  onClick={() => setIntent(g.id)}
                >
                  <span className="font-semibold text-on-surface">{g.title}</span>
                  <p className="mt-1 text-xs text-on-surface/60">{g.blurb}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {currentStep === 'scope' && (
          <>
            <h1 className="font-headline text-2xl font-bold text-primary">Reading scope</h1>
            <p className="mt-2 text-sm text-on-surface/65">Full Qur’an in order, or stay inside one surah until you finish it.</p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                className={choiceCardClass(readingScope === 'full_mushaf')}
                onClick={() => {
                  setReadingScope('full_mushaf')
                  setScopeSurah(null)
                }}
              >
                <span className="font-semibold text-on-surface">Full Qur’an</span>
                <p className="mt-1 text-xs text-on-surface/60">Start from Al-Fātiḥah (or a verse you pick) and continue surah by surah.</p>
              </button>
              <button
                type="button"
                className={choiceCardClass(readingScope === 'single_surah')}
                onClick={() => setReadingScope('single_surah')}
              >
                <span className="font-semibold text-on-surface">One surah</span>
                <p className="mt-1 text-xs text-on-surface/60">Mark complete advances āyah by āyah until the end of that surah.</p>
              </button>
            </div>
            {readingScope === 'single_surah' && (
              <div className="mt-6">
                <SurahAyahPicker
                  chapters={chapters}
                  surahId={scopeSurah}
                  onSurahChange={setScopeSurah}
                  surahLabel="Choose surah"
                  errorHint={chaptersErr}
                />
              </div>
            )}
          </>
        )}

        {currentStep === 'start' && (
          <>
            <h1 className="font-headline text-2xl font-bold text-primary">Where to start?</h1>
            <p className="mt-2 text-sm text-on-surface/65">
              {readingScope === 'single_surah'
                ? 'Begin at the opening āyah of that surah, or jump to a specific verse.'
                : 'Begin at Al-Fātiḥah, or pick any surah and āyah by name or number.'}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                className={choiceCardClass(startLocation === 'beginning')}
                onClick={() => setStartLocation('beginning')}
              >
                <span className="font-semibold text-on-surface">From the start</span>
                <p className="mt-1 text-xs text-on-surface/60">
                  {readingScope === 'single_surah' ? 'Āyah 1 of your chosen surah.' : 'Al-Fātiḥah 1:1.'}
                </p>
              </button>
              <button
                type="button"
                className={choiceCardClass(startLocation === 'custom')}
                onClick={() => setStartLocation('custom')}
              >
                <span className="font-semibold text-on-surface">Pick surah &amp; āyah</span>
                <p className="mt-1 text-xs text-on-surface/60">
                  {readingScope === 'single_surah' ? 'Must be inside your chosen surah.' : 'Search by surah name, then choose āyah.'}
                </p>
              </button>
            </div>
            {startLocation === 'custom' && readingScope === 'single_surah' && scopeSurah != null && (
              <SurahAyahPicker
                chapters={chapters}
                surahId={scopeSurah}
                onSurahChange={() => {}}
                lockSurahId={scopeSurah}
                showAyah
                ayahNumber={customAyahNum}
                onAyahChange={(n) => setCustomAyah(String(n))}
                surahLabel="Your surah"
              />
            )}
            {startLocation === 'custom' && readingScope === 'full_mushaf' && (
              <SurahAyahPicker
                chapters={chapters}
                surahId={Number.isFinite(customSurahNum) && customSurahNum >= 1 ? customSurahNum : null}
                onSurahChange={(id) => {
                  if (id != null) setCustomSurah(String(id))
                }}
                showAyah
                ayahNumber={customAyahNum}
                onAyahChange={(n) => setCustomAyah(String(n))}
                surahLabel="Search surah"
                errorHint={chaptersErr}
              />
            )}
          </>
        )}

        {currentStep === 'done' && (
          <>
            <h1 className="font-headline text-2xl font-bold text-primary">{isEditMode ? 'Review & save' : 'You’re ready'}</h1>
            <p className="mt-2 text-sm text-on-surface/65">
              {isEditMode ? (
                <>
                  Saving applies your choices and <strong className="font-semibold text-on-surface/80">moves your reading cursor</strong> to the
                  start position below (same as first-time setup).
                </>
              ) : (
                <>
                  Your dashboard shows the current verse. Each <strong className="font-semibold text-on-surface/80">Mark complete</strong> logs your
                  streak and moves you to the next āyah (within the scope you chose).
                </>
              )}
            </p>
            <p className="mt-4 rounded-xl border border-outline-variant/15 bg-surface-container-low/50 px-4 py-3 text-xs leading-relaxed text-on-surface/70">
              <span className="font-semibold text-on-surface/85">Summary: </span>
              {level && LEVELS.find((l) => l.id === level)?.title}
              {intent && ` · ${INTENTS.find((i) => i.id === intent)?.title}`}
              {readingScope && ` · ${readingScope === 'full_mushaf' ? 'Full Qur’an' : `Surah ${scopeSurah ?? '?'}`}`}
              {startLocation && ` · ${startLocation === 'beginning' ? 'From start' : 'Custom position'}`}
            </p>
            {err && <p className="mt-4 text-sm text-error">{err}</p>}
            <div className="mt-auto flex gap-3 pt-10">
              <Button type="button" variant="secondary" className="flex-1" disabled={submitting} onClick={goBack}>
                Back
              </Button>
              <Button type="button" className="flex-1" disabled={submitting} onClick={() => void submit()}>
                {submitting ? 'Saving…' : isEditMode ? 'Save changes' : 'Enter ASAR'}
              </Button>
            </div>
          </>
        )}

        {currentStep !== 'done' && (
          <div className="mt-auto flex gap-3 pt-10">
            <Button type="button" variant="secondary" className="flex-1" disabled={stepIndex === 0} onClick={goBack}>
              Back
            </Button>
            <Button type="button" className="flex-1" disabled={!canAdvance} onClick={handleContinue}>
              Continue
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
