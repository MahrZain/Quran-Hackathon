import type { HTMLAttributes, ReactNode } from 'react'

type GlassPanelProps = {
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLDivElement>

export function GlassPanel({ children, className = '', ...props }: GlassPanelProps) {
  return (
    <div
      className={`asar-glass rounded-bento ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
