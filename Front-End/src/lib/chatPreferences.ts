/** Persisted chat UI: reply language and optional Quran.com translation resource override. */

const REPLY_KEY = 'asar_chat_reply_language'
const VERSE_TR_KEY = 'asar_chat_verse_translation'

export const CHAT_REPLY_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto (browser)' },
  { value: 'en', label: 'English' },
  { value: 'ur', label: 'Urdu' },
  { value: 'ar', label: 'Arabic' },
  { value: 'fr', label: 'French' },
  { value: 'tr', label: 'Turkish' },
  { value: 'es', label: 'Spanish' },
  { value: 'id', label: 'Indonesian' },
  { value: 'bn', label: 'Bengali' },
] as const

export type ChatReplyLanguageValue = (typeof CHAT_REPLY_LANGUAGE_OPTIONS)[number]['value']

export const CHAT_VERSE_TRANSLATION_OPTIONS = [
  { value: 'default', label: 'Default (match language)', resourceId: null as number | null },
  { value: '85', label: 'English — Abdel Haleem', resourceId: 85 },
  { value: '20', label: 'English — Saheeh International', resourceId: 20 },
  { value: '234', label: 'Urdu — Jalandhari', resourceId: 234 },
  { value: '54', label: 'Urdu — Junagarhi', resourceId: 54 },
  { value: '97', label: 'Urdu — Maududi (Tafheem)', resourceId: 97 },
  { value: '31', label: 'French — Hamidullah', resourceId: 31 },
] as const

export type ChatVerseTranslationValue = (typeof CHAT_VERSE_TRANSLATION_OPTIONS)[number]['value']

function isReplyLanguage(v: string): v is ChatReplyLanguageValue {
  return CHAT_REPLY_LANGUAGE_OPTIONS.some((o) => o.value === v)
}

function isVerseTranslation(v: string): v is ChatVerseTranslationValue {
  return CHAT_VERSE_TRANSLATION_OPTIONS.some((o) => o.value === v)
}

export function loadChatReplyLanguage(): ChatReplyLanguageValue {
  try {
    const v = localStorage.getItem(REPLY_KEY)
    if (v && isReplyLanguage(v)) return v
  } catch {
    /* ignore */
  }
  return 'auto'
}

export function saveChatReplyLanguage(value: ChatReplyLanguageValue): void {
  try {
    localStorage.setItem(REPLY_KEY, value)
  } catch {
    /* ignore */
  }
}

export function loadChatVerseTranslation(): ChatVerseTranslationValue {
  try {
    const v = localStorage.getItem(VERSE_TR_KEY)
    if (v && isVerseTranslation(v)) return v
  } catch {
    /* ignore */
  }
  return 'default'
}

export function saveChatVerseTranslation(value: ChatVerseTranslationValue): void {
  try {
    localStorage.setItem(VERSE_TR_KEY, value)
  } catch {
    /* ignore */
  }
}

export function resolveAnswerLanguage(choice: ChatReplyLanguageValue): string {
  if (choice === 'auto' && typeof navigator !== 'undefined') {
    return navigator.language.split(/[-_]/)[0] || 'en'
  }
  if (choice === 'auto') return 'en'
  return choice
}

export function resolveTranslationResourceId(choice: ChatVerseTranslationValue): number | undefined {
  const row = CHAT_VERSE_TRANSLATION_OPTIONS.find((o) => o.value === choice)
  const id = row?.resourceId
  return id != null && id > 0 ? id : undefined
}
