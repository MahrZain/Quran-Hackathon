import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = {
  label: string
  id: string
  hint?: ReactNode
} & InputHTMLAttributes<HTMLInputElement>

export function Field({ label, id, hint, className = '', ...input }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-on-surface/70">
        {label}
      </label>
      <input
        id={id}
        className={`w-full border-0 border-b border-outline-variant/40 bg-transparent py-2 font-sans text-on-surface placeholder:text-on-surface/40 focus:border-secondary focus:outline-none focus:ring-0 ${className}`}
        {...input}
      />
      {hint ? <p className="text-xs text-on-surface/55">{hint}</p> : null}
    </div>
  )
}
