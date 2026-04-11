import type { HTMLAttributes } from 'react'

const sizeClass = {
  sm: 'text-lg sm:text-xl',
  md: 'text-2xl sm:text-3xl',
  lg: 'text-3xl sm:text-4xl',
  xl: 'text-4xl sm:text-5xl',
  '2xl': 'text-5xl sm:text-6xl',
} as const

type AsarWordmarkProps = {
  size?: keyof typeof sizeClass
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>

/** Spaced all-caps serif wordmark — brand pivot (replaces geometric icon). */
export function AsarWordmark({
  size = 'md',
  className = '',
  'aria-hidden': ariaHidden,
  'aria-label': ariaLabel,
  ...rest
}: AsarWordmarkProps) {
  const hideFromA11yTree = ariaHidden === true
  return (
    <span
      {...rest}
      className={`font-display font-medium uppercase tracking-widest text-primary-emerald antialiased [text-rendering:geometricPrecision] ${sizeClass[size]} ${className}`}
      aria-hidden={ariaHidden}
      aria-label={hideFromA11yTree ? undefined : (ariaLabel ?? 'ASAR')}
    >
      <span aria-hidden className="inline-block">
        A&nbsp;S&nbsp;A&nbsp;R
      </span>
    </span>
  )
}
