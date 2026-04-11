import { Lightbulb, Link2, Moon } from 'lucide-react'
import { Card } from '../components/ui/Card'

const items = [
  {
    title: 'Thematic echo',
    body: 'Your recent reading clusters around rizq, sabr, and gratitude—consider journaling one line per theme.',
    icon: Link2,
  },
  {
    title: 'Night rhythm',
    body: 'You open ASAR most after Maghrib. A shorter “focus” preset could match that energy.',
    icon: Moon,
  },
  {
    title: 'Gentle prompt',
    body: "Try pairing Yā Sīn with a single du'a intention for the week—keep the mentor questions narrow.",
    icon: Lightbulb,
  },
] as const

export function InsightsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <h1 className="font-serif text-3xl font-semibold text-primary">AI insight results</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Cards mirror the desktop “Nature Distilled” insight layout—replace copy with real analysis.
        </p>
      </header>
      <div className="flex flex-col gap-4">
        {items.map(({ title, body, icon: Icon }) => (
          <Card key={title} className="flex gap-4 p-6">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
              <Icon className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 className="font-serif text-lg font-semibold text-on-surface">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface/70">{body}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
