import type { HTMLAttributes, ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  interactive?: boolean
} & HTMLAttributes<HTMLDivElement>

export function Card({
  children,
  className = '',
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={`rounded-bento bg-surface-container-low p-5 shadow-ambient transition ${
        interactive
          ? 'cursor-pointer hover:bg-surface-container-highest hover:shadow-glass'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
