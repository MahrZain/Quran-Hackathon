import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { Card } from '../components/ui/Card'
import {
  downloadSanctuaryConfigJson,
  loadSanctuaryConfig,
  type SanctuaryConfig,
  saveSanctuaryConfig,
  sanctuaryConfigDefaults,
} from '../lib/sanctuaryConfig'

export function ConfigPage() {
  const [cfg, setCfg] = useState<SanctuaryConfig>(() => loadSanctuaryConfig())
  const [savedHint, setSavedHint] = useState(false)

  const update = useCallback((patch: Partial<SanctuaryConfig>) => {
    setCfg((c) => ({ ...c, ...patch }))
  }, [])

  const saveDraft = useCallback(() => {
    saveSanctuaryConfig(cfg)
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2500)
  }, [cfg])

  const resetDefaults = useCallback(() => {
    const d = sanctuaryConfigDefaults()
    setCfg(d)
    saveSanctuaryConfig(d)
    setSavedHint(true)
    window.setTimeout(() => setSavedHint(false), 2500)
  }, [])

  const exportBundle = useCallback(() => {
    saveSanctuaryConfig(cfg)
    downloadSanctuaryConfigJson(cfg)
  }, [cfg])

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <Link to="/settings" className="text-sm font-medium text-secondary hover:underline">
          ← Back to settings
        </Link>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-primary">Sanctuary configuration</h1>
        <p className="mt-2 text-sm text-on-surface/70">
          Draft values are stored in this browser only (<code className="text-xs">localStorage</code>). They do not
          yet override global app theme tokens.
        </p>
        {savedHint ? (
          <p className="mt-2 text-xs font-medium text-secondary" role="status">
            Saved to this device.
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-6">
        <Card className="p-6">
          <h2 className="font-serif text-lg font-semibold text-on-surface">Appearance</h2>
          <p className="mt-1 text-sm text-on-surface/60">Reference palette for exports and future theming.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field
              id="seed"
              label="Primary seed"
              placeholder="#064E3B"
              value={cfg.primarySeed}
              onChange={(e) => update({ primarySeed: e.target.value })}
            />
            <Field
              id="accent"
              label="Accent gold"
              placeholder="#D4AF37"
              value={cfg.accentGold}
              onChange={(e) => update({ accentGold: e.target.value })}
            />
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-serif text-lg font-semibold text-on-surface">Typography</h2>
          <p className="mt-1 text-sm text-on-surface/60">Spacing scale and locale hints for documentation exports.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Field
              id="scale"
              label="Spacing scale"
              placeholder="3"
              value={cfg.spacingScale}
              onChange={(e) => update({ spacingScale: e.target.value })}
            />
            <Field
              id="locale"
              label="Locale"
              placeholder="en"
              value={cfg.locale}
              onChange={(e) => update({ locale: e.target.value })}
            />
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => saveDraft()}>
            Save draft
          </Button>
          <Button type="button" variant="secondary" onClick={() => exportBundle()}>
            Export design bundle
          </Button>
          <Button type="button" variant="secondary" onClick={() => resetDefaults()}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
  )
}
