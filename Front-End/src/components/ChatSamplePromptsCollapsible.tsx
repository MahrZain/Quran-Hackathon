import { ChevronDown } from 'lucide-react'
import { useCallback, useId, useState } from 'react'
import { ChatSamplePrompts, type ChatSamplePrompt } from './ChatSamplePrompts'

const SESSION_OPEN_KEY = 'asar_chat_sample_prompts_open'

function readSessionOpen(): boolean | null {
  try {
    const v = sessionStorage.getItem(SESSION_OPEN_KEY)
    if (v === '1') return true
    if (v === '0') return false
  } catch {
    /* private mode */
  }
  return null
}

function writeSessionOpen(open: boolean) {
  try {
    sessionStorage.setItem(SESSION_OPEN_KEY, open ? '1' : '0')
  } catch {
    /* ignore */
  }
}

type ChatSamplePromptsCollapsibleProps = {
  prompts: ChatSamplePrompt[]
  onPick: (text: string) => void
  disabled?: boolean
  className?: string
  /** Open state when there is no session value yet. */
  defaultOpen?: boolean
}

/**
 * Collapsible sample prompts for active threads; persists open/closed in sessionStorage.
 */
export function ChatSamplePromptsCollapsible({
  prompts,
  onPick,
  disabled,
  className = '',
  defaultOpen = false,
}: ChatSamplePromptsCollapsibleProps) {
  const panelId = useId()
  const persisted = readSessionOpen()
  const [open, setOpen] = useState(persisted ?? defaultOpen)

  const toggle = useCallback(() => {
    setOpen((prev) => {
      const next = !prev
      writeSessionOpen(next)
      return next
    })
  }, [])

  return (
    <div className={`border-t border-outline-variant/15 bg-surface-container-low px-4 py-2 sm:px-5 ${className}`}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left text-xs font-semibold text-on-surface/85 transition hover:bg-surface-container-high/50"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
      >
        <span>
          Sample prompts
          <span className="ml-1 font-normal text-on-surface-variant/80">— tap to try</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={panelId} className="mt-2 pb-1">
          <ChatSamplePrompts
            prompts={prompts}
            onPick={onPick}
            disabled={disabled}
            showTitle={false}
            className="w-full"
          />
        </div>
      ) : null}
    </div>
  )
}
