import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'secondary' | 'ghost'

const variantClass: Record<Variant, string> = {
  primary:
    'bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-ambient hover:brightness-105 active:scale-[0.99]',
  secondary:
    'bg-surface-container-highest/40 backdrop-blur-md text-primary shadow-glass hover:bg-surface-container-highest/60',
  ghost: 'text-secondary hover:bg-surface-container-low/80',
}

const baseClass =
  'inline-flex items-center justify-center gap-2 rounded-pill px-6 py-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

type ButtonProps = {
  children: ReactNode
  variant?: Variant
  className?: string
} & ButtonHTMLAttributes<HTMLButtonElement>

export function Button({
  children,
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClass} ${variantClass[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

type ButtonLinkProps = {
  children: ReactNode
  variant?: Variant
  className?: string
} & LinkProps

export function ButtonLink({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={`${baseClass} ${variantClass[variant]} ${className}`} {...props}>
      {children}
    </Link>
  )
}
