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
}: {
  day: StreakConstellationDay
  isToday: boolean
  index: number
  onHover: (i: number) => void
  onLeave: () => void
  showTip: boolean
}) {
  const base =
    'relative z-20 flex cursor-default items-center justify-center rounded-full transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/60'

  const pulse = day.state !== 'empty'

  const inner = (
    <>
      {pulse ? (
        <m.span
          className={`block rounded-full bg-secondary ${isToday ? 'constellation-point h-4 w-4 border-[3px] border-emerald-50 shadow-[0_0_18px_rgba(212,175,55,0.55)]' : 'constellation-point h-3 w-3'}`}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: index * 0.12 }}
        />
      ) : (
        <span className="h-3 w-3 rounded-full border border-emerald-500/30 bg-emerald-900/50" />
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

  return (
    <span
      className={`${base} ${isToday ? 'min-h-8 min-w-8' : 'min-h-6 min-w-6'}`}
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

  return (
    <div className={`relative flex flex-1 items-center px-2 sm:px-4 ${className}`}>
      <div className="relative h-24 w-full">
        <div className="absolute top-1/2 left-0 h-px w-full bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <div className="relative z-20 flex h-full w-full items-center justify-between">
          {days.map((day, i) => (
            <ConstellationBead
              key={day.dateLabel}
              day={day}
              index={i}
              isToday={day.isToday}
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
