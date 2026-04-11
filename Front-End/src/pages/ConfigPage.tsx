import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Card } from '../components/ui/Card'

export function ConfigPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link to="/settings" className="text-sm font-medium text-secondary hover:underline">
          ← Back to settings
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-primary">Sanctuary configuration</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Desktop-style form sections—theme seeds, typography scale, and export hooks.
        </p>
      </header>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="font-serif text-lg font-semibold text-on-surface">Appearance</h2>
          <p className="mt-1 text-sm text-on-surface/60">
            Map to Stitch tokens: emerald seed, sand surfaces, brushed gold accents.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field id="seed" label="Primary seed" placeholder="#064E3B" defaultValue="#064E3B" />
            <Field id="accent" label="Accent gold" placeholder="#D4AF37" defaultValue="#D4AF37" />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-lg font-semibold text-on-surface">Typography</h2>
          <p className="mt-1 text-sm text-on-surface/60">
            Display uses Noto Serif; UI uses Inter at smaller scales.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field id="scale" label="Spacing scale" placeholder="3" defaultValue="3" />
            <Field id="locale" label="Locale" placeholder="en" defaultValue="en" />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="button">Save draft</Button>
          <Button type="button" variant="secondary">
            Export design bundle
          </Button>
        </div>
      </div>
    </div>
  )
}
