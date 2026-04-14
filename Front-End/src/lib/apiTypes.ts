export type ChatResponse = {
  ai_reply: string
  updated_streak_count: number
  verse_key?: string
  verse_text_uthmani?: string
  verse_translation?: string
  audio_url?: string | null
}

export type ChatTurnPayload = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatVerseCard = {
  ayah: string
  reference: string
  translation: string
}

export type ChatMessageRequestPayload = {
  session_id: string
  history: ChatTurnPayload[]
  message: string
}

export type ChatMessageResponse = {
  answer: string
  verses: ChatVerseCard[]
}

export type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

/** GET/POST /bookmarks — server-persisted verse bookmarks. */
export type VerseBookmarkOut = {
  id: number
  surah_id: number
  ayah_number: number
  verse_key: string
  note: string | null
  created_at: string
  quran_sync_status: 'pending' | 'synced' | 'failed'
}

export type StreakSnapshot = {
  updated_streak_count: number
}

/** One row from GET /streak/{session_id}/activities (date + verse marked that UTC day). */
export type StreakActivityItem = {
  activity_date: string
  ayah_read: string
}

export type StreakResponse = {
  ok: boolean
  updated_streak_count: number
  message: string
  quran_foundation_synced?: boolean
  next_verse_key?: string | null
  next_surah_id?: number | null
  next_ayah_number?: number | null
  ayahs_marked_today?: number
  at_scope_end?: boolean
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type OnboardingGoal = 'habit' | 'reading' | 'understand' | 'listen'
export type OnboardingLevel = 'beginner' | 'intermediate' | 'daily_learner' | 'regular'
export type OnboardingTimeBudget = '1' | '3' | '5_plus'
export type OnboardingJourneyMode = 'beginning' | 'daily_bites' | 'topic'
export type OnboardingTopicTag = 'patience' | 'stress' | 'gratitude' | 'hope' | 'fear' | 'general'
export type ReadingScope = 'full_mushaf' | 'single_surah'
export type StartLocation = 'beginning' | 'custom'

export type OnboardingCompletePayload = {
  goal: OnboardingGoal
  level: OnboardingLevel
  /** Simplified flow: habit / reading */
  reading_scope?: ReadingScope | null
  start_location?: StartLocation | null
  start_surah?: number | null
  start_ayah?: number | null
  scope_surah?: number | null
  /** Legacy understand / listen */
  time_budget?: OnboardingTimeBudget | null
  journey_mode?: OnboardingJourneyMode | null
  topic_tag?: OnboardingTopicTag | null
}

export type UserMe = {
  id: number
  email: string
  /** Server-owned session for chat/streak/history when authenticated. */
  asar_session_id: string
  onboarding_completed: boolean
  onboarding_goal?: string | null
  onboarding_level?: string | null
  onboarding_time_budget?: string | null
  onboarding_journey_mode?: string | null
  onboarding_topic_tag?: string | null
  /** Legacy policy-based key when cursor not set. */
  recommended_verse_key?: string | null
  /** Authoritative dashboard position after sequential reading onboarding. */
  current_verse_key?: string | null
  reading_scope?: string | null
  reading_scope_surah?: number | null
  ayahs_marked_today?: number
  /** True when cursor is on the last āyah of the user's scope (single surah or full mushaf). */
  at_reading_scope_end?: boolean
}

export type VerseBundleResponse = {
  verse_key: string
  verse_text_uthmani: string
  verse_translation: string
  audio_url: string | null
}

export type ChapterSummary = {
  id: number
  name: string
  transliteration: string
  verses: number
  revelation: string
}
