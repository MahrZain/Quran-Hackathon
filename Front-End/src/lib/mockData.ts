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
]

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

export function findAyahForMood(moodRaw: string): DailyAyah {
  const mood = moodRaw.trim().toLowerCase()
  const pool = moodVersePool
  if (!mood) {
    return pool[Math.floor(Math.random() * pool.length)]!
  }
  if (/(sad|heavy|hard|tired|fear|stress|angry|grief|hurt|lost|anxious|worried)/.test(mood)) {
    return pool.find((v) => v.surahId === 94) ?? pool[0]!
  }
  if (/(grateful|calm|hope|light|peace|joy|thank|love|blessed|content|still)/.test(mood)) {
    return pool.find((v) => v.surahId === 57) ?? pool[1]!
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

export function getDailyAyahForToday(verses: DailyAyah[] = dailyVerses): DailyAyah {
  if (verses.length === 0) {
    throw new Error('dailyVerses must not be empty')
  }
  const start = new Date(Date.UTC(new Date().getFullYear(), 0, 0))
  const today = new Date()
  const dayOfYear = Math.floor((today.getTime() - start.getTime()) / 86400000)
  return verses[dayOfYear % verses.length]!
}
