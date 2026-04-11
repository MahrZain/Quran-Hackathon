import { Link } from 'react-router-dom'

const textureImg =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDBYHiePHqLMHER-G_cdJzVbMY8iLHTE36Yu7yk_Vn2-6EpfT_VOE5a82oO_lEM3n0jGCfqcxAaaIt05t9Qh1V3Jr-XJ5j7qeCV1GF6WXLicvjTQsRTnBihOyiKvNqQHV_Glw3mJb-i7dqIm18twOSgq_eh5KGbz3Pgprh1K2T4lRkUQagTcKudxu5ZYIkQP79h4c-d4nXPURG3WEAvodpATMo3wbH_zR-kpjwt4tvTOvkPvy7ctt6SEc6Leuw5F6nPYQYPzTp7TTM'

export function WelcomePage() {
  return (
    <div className="relative flex min-h-svh w-full flex-col items-center justify-center overflow-x-hidden bg-surface py-8 text-on-surface">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary-fixed-dim/20 via-surface to-surface" />
        <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-surface-container-low/50 to-transparent" />
        <div className="absolute top-[10%] -left-20 h-64 w-64 rounded-full bg-primary-fixed-dim/10 blur-[80px]" />
        <div className="absolute -right-20 bottom-[5%] h-80 w-80 rounded-full bg-secondary-fixed/10 blur-[100px]" />
      </div>

      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-10 px-8 py-16">
        <div className="flex flex-col items-center space-y-6">
          <div className="ghost-border flex h-24 w-24 items-center justify-center rounded-full bg-surface-container-highest ambient-shadow">
            <span className="font-headline text-5xl font-bold tracking-tighter text-primary">ASAR</span>
          </div>
          <div className="space-y-2 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-primary">ASAR</h1>
            <p className="font-body text-sm font-light tracking-wide text-on-surface-variant">
              THE DIGITAL SANCTUARY
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-xs text-center">
          <p className="font-headline text-lg italic leading-relaxed text-on-surface opacity-80">
            &ldquo;Begin your 60-second journey...&rdquo;
          </p>
        </div>

        <div className="w-full space-y-3 pb-4">
          <Link
            to="/register"
            className="gold-glow silk-gradient group flex w-full items-center justify-center space-x-3 rounded-full px-6 py-5 text-on-primary transition-all duration-300 active:scale-95"
          >
            <span className="material-symbols-outlined text-secondary-fixed" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden>
              person_add
            </span>
            <span className="text-sm font-semibold tracking-wide">Create account</span>
          </Link>
          <Link
            to="/login"
            className="glass-effect ghost-border flex w-full items-center justify-center space-x-3 rounded-full px-6 py-5 text-on-primary-fixed-variant transition-all duration-300 hover:bg-surface-container/50 active:scale-95"
          >
            <span className="material-symbols-outlined text-primary" aria-hidden>
              login
            </span>
            <span className="text-sm font-medium tracking-wide">Sign in</span>
          </Link>
          <Link
            to="/quran"
            className="flex w-full items-center justify-center space-x-2 rounded-full border border-outline-variant/20 bg-surface-container-low/60 px-6 py-4 text-sm font-medium text-on-surface transition hover:bg-surface-container-low"
          >
            <span className="material-symbols-outlined text-base text-secondary" aria-hidden>
              auto_stories
            </span>
            <span>Connect with Quran.com</span>
          </Link>
          <Link
            to="/"
            className="flex w-full items-center justify-center rounded-full px-6 py-4 text-sm font-medium text-on-surface/70 transition hover:text-primary"
          >
            Continue as guest
          </Link>
          <div className="pt-6 text-center">
            <p className="font-label text-[10px] uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
              Wisdom • Presence • Peace
            </p>
          </div>
        </div>
      </main>

      <div className="pointer-events-none fixed left-0 top-0 z-[5] h-full w-full overflow-hidden opacity-30">
        <div className="absolute -right-20 -top-20 h-96 w-96 opacity-40 mix-blend-multiply">
          <img src={textureImg} alt="" className="h-full w-full rounded-full object-cover" />
        </div>
      </div>
    </div>
  )
}
