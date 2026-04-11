import type { ChatResponse } from './apiTypes'
import type { DailyAyah } from './mockData'
import { SURAH_LIST } from './mockData'

export function parseVerseKey(key: string): { surahId: number; ayahNumber: number } | null {
  const m = /^(\d+)\s*:\s*(\d+)$/.exec(key.trim())
  if (!m) return null
  return { surahId: Number(m[1]), ayahNumber: Number(m[2]) }
}

/** Prefer API verse + Uthmani from chat; fall back to mood-based mock ayah. */
export function dailyAyahFromChatResponse(data: ChatResponse, moodFallback: DailyAyah): DailyAyah {
  const parsed = data.verse_key ? parseVerseKey(data.verse_key) : null
  if (!parsed) return moodFallback
  const surah = SURAH_LIST.find((s) => s.id === parsed.surahId)
  const arabic = data.verse_text_uthmani?.trim() || moodFallback.arabic
  const translation = data.verse_translation?.trim() || moodFallback.translation
  return {
    surahId: parsed.surahId,
    surahName: surah?.transliteration ?? `Surah ${parsed.surahId}`,
    surahNameArabic: surah?.name ?? '',
    ayahNumber: parsed.ayahNumber,
    arabic,
    translation,
    audioUrl: data.audio_url ?? undefined,
  }
}
