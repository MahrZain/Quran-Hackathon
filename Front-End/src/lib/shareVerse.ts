const SHARE_TITLE = 'ASAR Sanctuary'

export type ShareVersePayload = {
  arabic: string
  reference: string
  translation: string
  /** Full URL to open this verse/context in the app */
  url: string
}

/** Deterministic share body (Arabic, reference, translation, URL). Exported for unit tests. */
export function formatVerseShareText(p: ShareVersePayload): string {
  const lines = [
    p.arabic.trim(),
    '',
    p.reference.trim(),
    p.translation.trim(),
    '',
    p.url.trim(),
  ]
  return lines.join('\n')
}

export async function shareVerse(payload: ShareVersePayload): Promise<void> {
  const text = formatVerseShareText(payload)
  const url = payload.url.trim()

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: SHARE_TITLE,
        text,
        url,
      })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      openWhatsAppShare(text)
    }
    return
  }

  openWhatsAppShare(text)
}

function openWhatsAppShare(text: string): void {
  const href = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(href, '_blank', 'noopener,noreferrer')
}
