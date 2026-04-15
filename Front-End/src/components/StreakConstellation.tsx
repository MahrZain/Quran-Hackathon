import { m } from 'framer-motion'
import { useState } from 'react'
import type { StreakConstellationDay } from '../lib/mockData'

type StreakConstellationProps = {
  days: StreakConstellationDay[]
  className?: string
}

function ConstellationBead({
  day,
  isToday,
  index,
  onHover,
  onLeave,
  showTip,
  compact,
}: {
  day: StreakConstellationDay
  isToday: boolean
  index: number
  onHover: (i: number) => void
  onLeave: () => void
  showTip: boolean
  compact: boolean
}) {
  const base =
    'relative z-20 flex cursor-default items-center justify-center justify-self-center rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60'

  const pulse = day.state !== 'empty'
  const motionDelay = Math.min(index * 0.05, 1.4)

  const filledClass = compact
    ? isToday
      ? 'constellation-point h-3 w-3 border-2 border-emerald-50 shadow-[0_0_12px_rgba(212,175,55,0.45)] sm:h-3.5 sm:w-3.5'
      : 'constellation-point h-2 w-2 sm:h-2.5 sm:w-2.5'
    : isToday
      ? 'constellation-point h-4 w-4 border-[3px] border-emerald-50 shadow-[0_0_18px_rgba(212,175,55,0.55)]'
      : 'constellation-point h-3 w-3'

  const emptyClass = compact
    ? 'h-2 w-2 rounded-full border border-emerald-500/30 bg-emerald-900/50 sm:h-2.5 sm:w-2.5'
    : 'h-3 w-3 rounded-full border border-emerald-500/30 bg-emerald-900/50'

  const inner = (
    <>
      {pulse ? (
        <m.span
          className={`block rounded-full bg-secondary ${filledClass}`}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: motionDelay }}
        />
      ) : (
        <span className={emptyClass} />
      )}
      {showTip && (
        <div
          role="tooltip"
          className="asar-glass pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-50 w-48 -translate-x-1/2 rounded-xl px-3 py-2 text-left shadow-ambient"
        >
          <p className="font-label text-[10px] font-bold uppercase tracking-wider text-emerald-200/90">
            {day.dateLabel}
          </p>
          <p className="mt-1 text-xs leading-snug text-emerald-50/95">{day.impact}</p>
        </div>
      )}
    </>
  )

  const outerSize = compact
    ? isToday
      ? 'min-h-7 min-w-7 sm:min-h-8 sm:min-w-8'
      : 'min-h-5 min-w-5 sm:min-h-6 sm:min-w-6'
    : isToday
      ? 'min-h-8 min-w-8'
      : 'min-h-6 min-w-6'

  return (
    <span
      className={`${base} ${outerSize}`}
      onMouseEnter={() => onHover(index)}
      onMouseLeave={onLeave}
      onFocus={() => onHover(index)}
      onBlur={onLeave}
      tabIndex={0}
    >
      {inner}
    </span>
  )
}

export function StreakConstellation({ days, className = '' }: StreakConstellationProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const compact = days.length > 14

  return (
    <div className={`relative flex flex-1 items-center px-1 sm:px-3 ${className}`}>
      <div className="relative min-h-[5.5rem] w-full sm:min-h-[4.5rem]">
        <div className="pointer-events-none absolute inset-0 rounded-lg bg-gradient-to-r from-transparent via-emerald-500/15 to-transparent opacity-80" />
        <div className="relative z-20 grid w-full grid-cols-10 justify-items-center gap-x-0 gap-y-1.5 py-1 sm:grid-cols-15 sm:gap-y-2">
          {days.map((day, i) => (
            <ConstellationBead
              key={`${i}-${day.dateLabel}`}
              day={day}
              index={i}
              isToday={day.isToday}
              compact={compact}
              onHover={setHovered}
              onLeave={() => setHovered(null)}
              showTip={hovered === i}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
