import { m } from 'framer-motion'
import { memo, useMemo } from 'react'

const VIEW = 200
const CX = 100
const CY = 100
const R = 82
const STROKE = 12

const FILTER_ID = 'asar-daily-flow-glow'
const GRAD_ID = 'asar-daily-flow-gold'

type DailyFlowRingProps = {
  percent: number
  className?: string
}

function DailyFlowRingInner({ percent, className = '' }: DailyFlowRingProps) {
  const circumference = useMemo(() => 2 * Math.PI * R, [])
  const clamped = Math.min(100, Math.max(0, percent))
  const targetOffset = circumference * (1 - clamped / 100)

  return (
    <div className={`relative aspect-square w-[min(100%,14rem)] max-w-[18rem] sm:w-[min(100%,16rem)] ${className}`}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="rotate-[-90deg] drop-shadow-[0_0_12px_rgba(212,175,55,0.2)]"
        aria-hidden
      >
        <defs>
          <filter id={FILTER_ID} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={GRAD_ID} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D4AF37" />
            <stop offset="55%" stopColor="#e8c85c" />
            <stop offset="100%" stopColor="#9a7b1a" />
          </linearGradient>
        </defs>
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          className="text-surface-container"
          opacity={0.55}
        />
        <m.circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={`url(#${GRAD_ID})`}
          strokeWidth={STROKE}
          strokeLinecap="round"
          filter={`url(#${FILTER_ID})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: targetOffset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
    </div>
  )
}

export const DailyFlowRing = memo(DailyFlowRingInner, (prev, next) => {
  return prev.percent === next.percent && prev.className === next.className
})

DailyFlowRing.displayName = 'DailyFlowRing'
