import { useCallback, useMemo, useRef } from 'react'
/** Default import is a CJS interop object `{ Textfit, default }` in Vite — use named export. */
import { Textfit } from 'react-textfit'

type QuranAyahTextProps = {
  text: string
  /** When true, outer wrapper grows in flex layouts (e.g. ayah card). */
  flexFill?: boolean
  /** Use full reading width (e.g. reader page) instead of bento max-width. */
  fullWidth?: boolean
  className?: string
}

/**
 * Mushaf-grade Arabic: local KFGQPC / Uthmanic Hafs if installed, else web fallback (see index.css).
 * `react-textfit` `mode="multi"` scales to fit; line-height 1.8 for larger fits, 2.2 when scaled down.
 *
 * Line-height is applied on the inner span via ref + DOM (not React state on the Textfit `style` prop).
 * Otherwise `onReady` → setState → new `style` → Textfit `componentDidUpdate` → `process()` loops and can
 * hit "Maximum update depth exceeded" (blank page).
 */
export function QuranAyahText({
  text,
  flexFill = false,
  fullWidth = false,
  className = '',
}: QuranAyahTextProps) {
  const isLong = text.length > 150
  const arabicRef = useRef<HTMLSpanElement>(null)

  const handleReady = useCallback((fontSize: number) => {
    const el = arabicRef.current
    if (!el) return
    el.style.lineHeight = String(fontSize >= 22 ? 1.8 : 2.2)
  }, [])

  const textfitStyle = useMemo(
    () =>
      ({
        width: '100%',
        height: isLong ? 320 : flexFill ? '100%' : undefined,
        minHeight: isLong ? 200 : flexFill ? 180 : 160,
        fontWeight: 400,
        letterSpacing: 0,
        textRendering: 'optimizeLegibility',
        WebkitFontSmoothing: 'antialiased',
      }) as const,
    [isLong, flexFill],
  )

  const outerClass = [
    'w-full',
    !fullWidth ? 'max-w-3xl' : null,
    isLong ? 'max-h-[400px] overflow-y-auto quran-ayah-scrollbar' : null,
    flexFill && !isLong ? 'flex min-h-0 flex-1 flex-col' : null,
    className || null,
  ]
    .filter((c): c is string => Boolean(c))
    .join(' ')

  let innerClass = 'box-border w-full p-8'
  if (isLong) {
    innerClass += ' min-h-[12rem]'
  } else if (flexFill) {
    innerClass += ' flex h-full min-h-0 flex-1 flex-col'
  } else {
    innerClass += ' min-h-[10rem]'
  }

  return (
    <div className={outerClass}>
      <div className={innerClass}>
        <Textfit
          key={text}
          mode="multi"
          min={14}
          max={isLong ? 32 : 46}
          throttle={80}
          autoResize
          onReady={handleReady}
          className="quran-mushaf text-primary transition-[font-size] duration-200 ease-out"
          style={textfitStyle}
        >
          <span ref={arabicRef} dir="rtl" lang="ar" style={{ lineHeight: 1.8 }}>
            {text}
          </span>
        </Textfit>
      </div>
    </div>
  )
}
