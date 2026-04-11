import { QuranAyahText } from '../components/QuranAyahText'
import { SAMPLE_AYAH, SAMPLE_TRANSLATION } from '../lib/mockData'

export function FocusPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col justify-center">
      <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.25em] text-secondary">
        Focus mode
      </p>
      <div className="rounded-bento bg-surface-container-lowest/90 p-8 shadow-ambient sm:p-12">
        <QuranAyahText text={SAMPLE_AYAH} className="mx-auto" />
        <p className="mx-auto mt-8 max-w-md text-center text-sm leading-relaxed text-on-surface/65">
          {SAMPLE_TRANSLATION}
        </p>
      </div>
      <p className="mt-8 text-center text-xs text-on-surface/45">
        Dim chrome, enlarge type, and hide nav in a later pass.
      </p>
    </div>
  )
}
