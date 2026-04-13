export type ChatSamplePrompt = {
  /** Short label on the chip */
  label: string
  /** Full message sent or placed in the input */
  text: string
}

type ChatSamplePromptsProps = {
  prompts: ChatSamplePrompt[]
  /** Called with full prompt text (parent may send or set draft). */
  onPick: (text: string) => void
  disabled?: boolean
  /** If true, chips only fill the input; if false, parent handles send on pick. */
  className?: string
}

export function ChatSamplePrompts({ prompts, onPick, disabled, className = '' }: ChatSamplePromptsProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
        Sample prompts — tap to try
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={disabled}
            onClick={() => onPick(p.text)}
            className="rounded-full border border-outline-variant/35 bg-transparent px-3 py-1.5 text-left text-xs font-medium text-on-surface/85 transition hover:border-outline-variant/55 hover:bg-surface-container-high/80 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
