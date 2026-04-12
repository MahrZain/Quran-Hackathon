import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { apiErrorMessage } from '../lib/apiErrors'

const textureImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDBYHiePHqLMHER-G_cdJzVbMY8iLHTE36Yu7yk_Vn2-6EpfT_VOE5a82oO_lEM3n0jGCfqcxAaaIt05t9Qh1V3Jr-XJ5j7qeCV1GF6WXLicvjTQsRTnBihOyiKvNqQHV_Glw3mJb-i7dqIm18twOSgq_eh5KGbz3Pgprh1K2T4lRkUQagTcKudxu5ZYIkQP79h4c-d4nXPURG3WEAvodpATMo3wbH_zR-kpjwt4tvTOvkPvy7ctt6SEc6Leuw5F6nPYQYPzTp7TTM'

export function WelcomePage() {
  const { loginDemo, startQuranFoundationLogin } = useAuth()
  const navigate = useNavigate()
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoErr, setDemoErr] = useState<string | null>(null)

  async function handleDemo() {
    setDemoErr(null)
    setDemoBusy(true)
    try {
      await loginDemo()
      navigate('/', { replace: true })
    } catch (e) {
      setDemoErr(apiErrorMessage(e))
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-x-hidden bg-surface py-8 text-on-surface">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-fixed-dim/20 via-surface to-surface" />
        <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-surface-container-low/50 to-transparent" />
        <div className="absolute top-[10%] -left-20 h-64 w-64 rounded-full bg-primary-fixed-dim/10 blur-[80px]" />
        <div className="absolute -right-20 bottom-[5%] h-80 w-80 rounded-full bg-secondary-fixed/10 blur-[100px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8 px-6 py-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="ghost-border flex h-20 w-20 items-center justify-center rounded-full bg-surface-container-highest ambient-shadow">
            <span className="font-headline text-4xl font-bold text-primary">ASAR</span>
          </div>
          <h1 className="font-headline text-3xl font-bold text-primary">ASAR</h1>
          <p className="text-sm text-on-surface/65">The digital sanctuary</p>
        </div>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => startQuranFoundationLogin()}
            className="gold-glow silk-gradient flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-semibold text-on-primary shadow-lg transition active:scale-[0.99]"
          >
            Continue with Quran.com
          </button>

          <button
            type="button"
            disabled={demoBusy}
            onClick={() => void handleDemo()}
            className="flex w-full items-center justify-center rounded-full border border-secondary/35 bg-surface-container-low px-6 py-3.5 text-sm font-semibold text-secondary transition hover:bg-surface-container disabled:opacity-55"
          >
            {demoBusy ? 'Opening…' : 'Try demo'}
          </button>
          {demoErr && <p className="text-center text-xs text-error">{demoErr}</p>}

          <p className="pt-2 text-center text-[11px] leading-relaxed text-on-surface/50">
            Use your Quran.com account for a personal profile, or try the shared demo to explore the
            app without signing in to Quran Foundation.
          </p>
        </div>
      </main>

      <div className="pointer-events-none fixed left-0 top-0 z-[5] h-full w-full overflow-hidden opacity-25">
        <div className="absolute -right-20 -top-20 h-96 w-96 opacity-40 mix-blend-multiply">
          <img src={textureImg} alt="" className="h-full w-full rounded-full object-cover" />
        </div>
      </div>
    </div>
  )
}
