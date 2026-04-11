declare module 'react-textfit' {
  import type { Component, CSSProperties, ReactNode } from 'react'

  export type TextfitProps = {
    children?: ReactNode
    text?: string
    min?: number
    max?: number
    mode?: 'single' | 'multi'
    forceWidth?: boolean
    forceSingleModeWidth?: boolean
    throttle?: number
    autoResize?: boolean
    onReady?: (fontSize: number) => void
    style?: CSSProperties
    className?: string
  }

  export class Textfit extends Component<TextfitProps> {}

  /** Prefer `import { Textfit }` — default can be a CJS interop object in Vite. */
  export default Textfit
}
