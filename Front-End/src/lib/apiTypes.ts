export type ChatResponse = {
  ai_reply: string
  updated_streak_count: number
  verse_key?: string
  verse_text_uthmani?: string
  verse_translation?: string
  audio_url?: string | null
}

export type HistoryMessage = {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type StreakSnapshot = {
  updated_streak_count: number
}

export type StreakResponse = {
  ok: boolean
  updated_streak_count: number
  message: string
  quran_foundation_synced?: boolean
}

export type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

export type UserMe = {
  id: number
  email: string
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
