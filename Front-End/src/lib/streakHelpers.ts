import type { StreakConstellationDay } from './mockData'

/** Map backend streak count to a row of constellation beads (last `width` days, filled from the right). */
export function constellationDaysFromStreak(streakCount: number, width = 7): StreakConstellationDay[] {
  const safe = Math.max(0, Math.floor(streakCount))
  const filled = Math.min(safe, width)
  const now = new Date()
  const days: StreakConstellationDay[] = []

  for (let i = 0; i < width; i++) {
    const daysAgo = width - 1 - i
    const d = new Date(now)
    d.setDate(d.getDate() - daysAgo)
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const isToday = daysAgo === 0
    const isFilled = i >= width - filled

    days.push({
      dateLabel,
      impact: isFilled
        ? 'Counts toward your current streak (reading logged this day).'
        : 'No streak reading this day — tap Mark complete after your āyah.',
      state: isFilled ? 'filled' : 'empty',
      isToday,
    })
  }

  return days
}
