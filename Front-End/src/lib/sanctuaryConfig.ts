const STORAGE_KEY = 'asar_sanctuary_config_v1'

export type SanctuaryConfig = {
  primarySeed: string
  accentGold: string
  spacingScale: string
  locale: string
}

const defaults: SanctuaryConfig = {
  primarySeed: '#064E3B',
  accentGold: '#D4AF37',
  spacingScale: '3',
  locale: 'en',
}

function parse(raw: string | null): SanctuaryConfig {
  if (!raw) return { ...defaults }
  try {
    const o = JSON.parse(raw) as Record<string, unknown>
    return {
      primarySeed: typeof o.primarySeed === 'string' ? o.primarySeed : defaults.primarySeed,
      accentGold: typeof o.accentGold === 'string' ? o.accentGold : defaults.accentGold,
      spacingScale: typeof o.spacingScale === 'string' ? o.spacingScale : defaults.spacingScale,
      locale: typeof o.locale === 'string' ? o.locale : defaults.locale,
    }
  } catch {
    return { ...defaults }
  }
}

export function loadSanctuaryConfig(): SanctuaryConfig {
  try {
    return parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    return { ...defaults }
  }
}

export function saveSanctuaryConfig(c: SanctuaryConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c))
}

export function sanctuaryConfigDefaults(): SanctuaryConfig {
  return { ...defaults }
}

export function downloadSanctuaryConfigJson(c: SanctuaryConfig): void {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sanctuary-config.json'
  a.click()
  URL.revokeObjectURL(url)
}
