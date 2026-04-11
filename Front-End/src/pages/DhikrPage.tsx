import { Link } from 'react-router-dom'

export function DhikrPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold text-primary">Daily Dhikr</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Stitch screen: potted plant rhythm—replace with your dhikr modules and timers.
          </p>
        </div>
        <span className="material-symbols-outlined text-4xl text-secondary" aria-hidden>
          potted_plant
        </span>
      </header>
      <div className="rounded-stitch bg-surface-container-low p-8 shadow-ambient">
        <p className="text-on-surface/80">
          This route matches the sidebar and mobile nav from your Stitch dashboard export. Hook up
          audio, counts, and streaks here.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex text-sm font-bold text-secondary hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
