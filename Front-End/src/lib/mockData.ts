export type Surah = {
  id: number
  name: string
  transliteration: string
  verses: number
  revelation: 'Meccan' | 'Medinan'
}

export type DailyAyah = {
  surahId: number
  surahName: string
  surahNameArabic: string
  ayahNumber: number
  arabic: string
  translation: string
  /** When set (e.g. from chat / Quran API), Play Recitation uses this URL. */
  audioUrl?: string | null
}

export type StreakConstellationDay = {
  dateLabel: string
  impact: string
  state: 'filled' | 'empty'
  isToday: boolean
}

export const SURAH_LIST: Surah[] = [
  { id: 1, name: 'الفاتحة', transliteration: 'Al-Fātiḥah', verses: 7, revelation: 'Meccan' },
  { id: 2, name: 'البقرة', transliteration: 'Al-Baqarah', verses: 286, revelation: 'Medinan' },
  { id: 36, name: 'يس', transliteration: 'Yā Sīn', verses: 83, revelation: 'Meccan' },
  { id: 51, name: 'الذاريات', transliteration: 'Adh-Dhāriyāt', verses: 60, revelation: 'Meccan' },
  { id: 55, name: 'الرحمن', transliteration: 'Ar-Raḥmān', verses: 78, revelation: 'Medinan' },
  { id: 57, name: 'الحديد', transliteration: 'Al-Hadid', verses: 29, revelation: 'Medinan' },
  { id: 67, name: 'الملك', transliteration: 'Al-Mulk', verses: 30, revelation: 'Meccan' },
  { id: 94, name: 'الشرح', transliteration: 'Ash-Sharḥ', verses: 8, revelation: 'Meccan' },
  { id: 112, name: 'الإخلاص', transliteration: 'Al-Ikhlāṣ', verses: 4, revelation: 'Meccan' },
  { id: 113, name: 'الفلق', transliteration: 'Al-Falaq', verses: 5, revelation: 'Meccan' },
  { id: 114, name: 'الناس', transliteration: 'An-Nās', verses: 6, revelation: 'Meccan' },
]

/**
 * Resolve surah labels for the current `surahId`. If the id is in SURAH_LIST, that wins (avoids stale names after
 * changing verse); otherwise keep embedded names from verse objects, else `Surah {id}`.
 */
export function fillSurahMeta(ayah: DailyAyah): DailyAyah {
  const fromList = SURAH_LIST.find((s) => s.id === ayah.surahId)
  const name = (ayah.surahName || '').trim()
  const nameAr = (ayah.surahNameArabic || '').trim()
  return {
    ...ayah,
    surahName: fromList?.transliteration ?? (name || `Surah ${ayah.surahId}`),
    surahNameArabic: fromList?.name ?? nameAr,
  }
}

export const SAMPLE_AYAH = "وَمَا خَلَقْتُ ٱلْجِنَّ وَٱلْإِنسَ إِلَّا لِيَعْبُدُونِ"

export const SAMPLE_TRANSLATION = "And I did not create the jinn and mankind except to worship Me."

export const dailyVerses: DailyAyah[] = [
  {
    surahId: 94,
    surahName: 'Ash-Sharh',
    surahNameArabic: 'الشرح',
    ayahNumber: 5,
    arabic: "فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا",
    translation: "For indeed, with hardship [will be] ease.",
  },
  {
    surahId: 57,
    surahName: 'Al-Hadid',
    surahNameArabic: 'الحديد',
    ayahNumber: 4,
    arabic: "هُوَ ٱلَّذِى خَلَقَ ٱلسَّمَٰوَٰتِ وَٱلْأَرْضَ فِى سِتَّةِ أَيَّامٍۢ ثُمَّ ٱسْتَوَىٰ عَلَى ٱلْعَرْشِ ۚ يَعْلَمُ مَا يَلِجُ فِى ٱلْأَرْضِ وَمَا يَخْرُجُ مِنْهَا وَمَا يَنزِلُ مِنَ ٱلسَّمَآءِ وَمَا يَعْرُجُ فِيهَا ۖ وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ ۚ وَٱللَّهُ بِمَا تَعْمَلُونَ بَصِيرٌۭ",
    translation: "It is He who created the heavens and earth in six days and then established Himself above the Throne. He knows what penetrates into the earth and what emerges from it and what descends from the heaven and what ascends therein; and He is with you wherever you are. And Allah, of what you do, is Seeing.",
  },
]

const dhariyatVerse: DailyAyah = {
  surahId: 51,
  surahName: 'Adh-Dhariyat',
  surahNameArabic: 'الذاريات',
  ayahNumber: 56,
  arabic: SAMPLE_AYAH,
  translation: SAMPLE_TRANSLATION,
}

export const moodVersePool: DailyAyah[] = [...dailyVerses, dhariyatVerse]

/** Matches Back-End `TOPIC_VERSE` in onboarding_policy.py */
export const TOPIC_TAG_TO_VERSE_KEY: Record<string, string> = {
  patience: '2:153',
  stress: '94:5',
  gratitude: '2:152',
  hope: '39:53',
  fear: '3:173',
  general: '1:1',
}

const anchoredVerses: DailyAyah[] = [
  {
    surahId: 1,
    surahName: 'Al-Fātiḥah',
    surahNameArabic: 'الفاتحة',
    ayahNumber: 1,
    arabic: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
    translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
  },
  {
    surahId: 2,
    surahName: 'Al-Baqarah',
    surahNameArabic: 'البقرة',
    ayahNumber: 152,
    arabic: 'فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ',
    translation: 'So remember Me; I will remember you. And be grateful to Me and do not deny Me.',
  },
  {
    surahId: 2,
    surahName: 'Al-Baqarah',
    surahNameArabic: 'البقرة',
    ayahNumber: 153,
    arabic: 'يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ',
    translation: 'O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.',
  },
  {
    surahId: 39,
    surahName: 'Az-Zumar',
    surahNameArabic: 'الزمر',
    ayahNumber: 53,
    arabic: 'قُلْ يَٰعِبَادِىَ ٱلَّذِينَ أَسْرَفُوا۟ عَلَىٰٓ أَنفُسِهِمْ لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ',
    translation: 'Say, "O My servants who have transgressed against themselves, do not despair of the mercy of Allah."',
  },
  {
    surahId: 3,
    surahName: 'Āl Imrān',
    surahNameArabic: 'آل عمران',
    ayahNumber: 173,
    arabic: 'ٱلَّذِينَ قَالَ لَهُمُ ٱلنَّاسُ إِنَّ ٱلنَّاسَ قَدْ جَمَعُوا۟ لَكُمْ فَٱخْشَوْهُمْ فَزَادَهُمْ إِيمَٰنًۭا',
    translation: 'Those to whom people said, "Indeed, the people have gathered against you, so fear them." But it increased them in faith.',
  },
]

function surahMeta(surahId: number) {
  return SURAH_LIST.find((s) => s.id === surahId)
}

/** Resolve a verse key to a DailyAyah (known catalog or skeleton for API hydration). */
export function dailyAyahFromVerseKey(verseKey: string): DailyAyah {
  const parts = verseKey.split(':')
  const si = Number(parts[0])
  const an = Number(parts[1])
  if (!Number.isFinite(si) || !Number.isFinite(an)) {
    return getColdStartDailyAyah()
  }
  const poolAll = [...anchoredVerses, ...moodVersePool, ...dailyVerses]
  const hit = poolAll.find((v) => v.surahId === si && v.ayahNumber === an)
  if (hit) return { ...hit }
  const meta = surahMeta(si)
  return {
    surahId: si,
    ayahNumber: an,
    surahName: meta?.transliteration ?? `Surah ${si}`,
    surahNameArabic: meta?.name ?? '',
    arabic: '…',
    translation: 'Loading…',
  }
}

/** Onboarding / settings: theme tag → āyah (aligned with server policy). */
export function getDailyAyahFromTopicTag(tagRaw: string): DailyAyah {
  const tag = tagRaw.trim().toLowerCase().replace(/\s+/g, '_')
  const key = TOPIC_TAG_TO_VERSE_KEY[tag] ?? TOPIC_TAG_TO_VERSE_KEY.general
  return dailyAyahFromVerseKey(key)
}

export function findAyahForMood(moodRaw: string): DailyAyah {
  const mood = moodRaw.trim().toLowerCase()
  const pool = moodVersePool
  if (TOPIC_TAG_TO_VERSE_KEY[mood] !== undefined) {
    return getDailyAyahFromTopicTag(mood)
  }
  if (!mood) {
    return pool[Math.floor(Math.random() * pool.length)]!
  }
  if (/(sad|heavy|hard|tired|stress|angry|grief|hurt|lost|anxious|worried)/.test(mood)) {
    return pool.find((v) => v.surahId === 94) ?? pool[0]!
  }
  if (/(grateful|calm|hope|light|peace|joy|thank|love|blessed|content|still)/.test(mood)) {
    return pool.find((v) => v.surahId === 57) ?? pool[1]!
  }
  if (/(patience|patient|sabr)/.test(mood)) {
    return getDailyAyahFromTopicTag('patience')
  }
  if (/(gratitude|thankful)/.test(mood)) {
    return getDailyAyahFromTopicTag('gratitude')
  }
  let h = 0
  for (let i = 0; i < mood.length; i++) h = (h + mood.charCodeAt(i) * (i + 1)) % 1009
  return pool[h % pool.length]!
}

export const STREAK_CONSTELLATION_DAYS: StreakConstellationDay[] = [
  {
    dateLabel: 'Apr 5',
    impact: 'Dhikr after Fajr anchored the day before a difficult meeting.',
    state: 'filled',
    isToday: false,
  },
  {
    dateLabel: 'Apr 6',
    impact: 'You chose silence over reaction; the heart score edged upward.',
    state: 'filled',
    isToday: false,
  },
  {
    dateLabel: 'Apr 7',
    impact: 'A short reflection on rizq softened anxiety about tomorrow.',
    state: 'filled',
    isToday: false,
  },
  {
    dateLabel: 'Apr 8',
    impact: "Today's ASAR: a gratitude note and one extra rak'ah of care.",
    state: 'filled',
    isToday: true,
  },
  {
    dateLabel: 'Apr 9',
    impact: 'Reserved for your next alignment.',
    state: 'empty',
    isToday: false,
  },
  {
    dateLabel: 'Apr 10',
    impact: 'Reserved for your next alignment.',
    state: 'empty',
    isToday: false,
  },
  {
    dateLabel: 'Apr 11',
    impact: 'Reserved for your next alignment.',
    state: 'empty',
    isToday: false,
  },
]

/** Cold start: Ash-Sharh 94:5 (empty streak / new account). */
export function getColdStartDailyAyah(): DailyAyah {
  const v = dailyVerses.find((x) => x.surahId === 94 && x.ayahNumber === 5)
  return v ?? dailyVerses[0]!
}

export function getDailyAyahForToday(verses: DailyAyah[] = dailyVerses): DailyAyah {
  if (verses.length === 0) {
    throw new Error('dailyVerses must not be empty')
  }
  const start = new Date(Date.UTC(new Date().getFullYear(), 0, 0))
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return verses[dayOfYear % verses.length]!
}
