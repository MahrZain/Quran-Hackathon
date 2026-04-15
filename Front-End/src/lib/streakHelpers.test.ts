import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { constellationDaysFromStreak } from './streakHelpers'

describe('constellationDaysFromStreak', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-15T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to 30 days', () => {
    expect(constellationDaysFromStreak(0)).toHaveLength(30)
  })

  it('respects custom width', () => {
    expect(constellationDaysFromStreak(2, 7)).toHaveLength(7)
  })

  it('marks today on the last slot', () => {
    const days = constellationDaysFromStreak(0, 7)
    expect(days[6]?.isToday).toBe(true)
    expect(days.filter((d) => d.isToday)).toHaveLength(1)
  })

  it('fills from the right up to streak count', () => {
    const days = constellationDaysFromStreak(3, 10)
    const filled = days.filter((d) => d.state === 'filled')
    expect(filled).toHaveLength(3)
    expect(days[7]?.state).toBe('filled')
    expect(days[8]?.state).toBe('filled')
    expect(days[9]?.state).toBe('filled')
    expect(days[0]?.state).toBe('empty')
  })

  it('caps filled slots at width', () => {
    const days = constellationDaysFromStreak(100, 12)
    expect(days.every((d) => d.state === 'filled')).toBe(true)
  })
})
