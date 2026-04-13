import type { ChatSamplePrompt } from '../components/ChatSamplePrompts'

/** Quran companion — search / theme / reference style questions. */
export const companionSamplePrompts: ChatSamplePrompt[] = [
  {
    label: 'Verses on patience',
    text: 'Please share a few Quranic verses about patience (sabr) and a short reflection.',
  },
  {
    label: 'Explain 1:5 briefly',
    text: 'In simple language, what is Surah Al-Fatihah, ayah 5 asking us to do?',
  },
  {
    label: 'Gratitude & mercy',
    text: 'What does the Quran say about gratitude (shukr) and Allah’s mercy?',
  },
  {
    label: 'Reference: 2:286',
    text: 'Help me understand the meaning and context of Surah Al-Baqarah, ayah 286.',
  },
]

/** Heart, adab, single-ayah style (same chat as companion). */
export const mentorSamplePrompts: ChatSamplePrompt[] = [
  {
    label: 'One ayah when anxious',
    text: 'Suggest one ayah I can hold in my heart when I feel anxious, with a gentle explanation.',
  },
  {
    label: 'Stay consistent',
    text: 'How can I keep a small, sustainable habit of Quran and dhikr without burning out?',
  },
  {
    label: 'Adab with the Quran',
    text: 'What adab (manners) should I keep in mind when I open the Quran or ask questions about it?',
  },
  {
    label: 'Brief tafsir: 93:7',
    text: 'Give a brief, humble note on Surah Ad-Duha, ayah 7 and what it might mean for someone feeling low.',
  },
]

/** All starter prompts for the single Quran companion chat. */
export const allChatSamplePrompts: ChatSamplePrompt[] = [
  ...companionSamplePrompts,
  ...mentorSamplePrompts,
]
