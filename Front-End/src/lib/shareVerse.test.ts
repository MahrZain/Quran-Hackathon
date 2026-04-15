import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatVerseShareText, shareVerse } from './shareVerse'

describe('formatVerseShareText', () => {
  it('joins Arabic, reference, translation, and URL with blank lines', () => {
    const text = formatVerseShareText({
      arabic: '  بِسْمِ  ',
      reference: '1:1',
      translation: ' In the name ',
      url: 'https://example.com/quran/1?ayah=1',
    })
    expect(text).toBe(
      [
        'بِسْمِ',
        '',
        '1:1',
        'In the name',
        '',
        'https://example.com/quran/1?ayah=1',
      ].join('\n'),
    )
  })
})

describe('shareVerse', () => {
  const payload = {
    arabic: 'x',
    reference: '1:1',
    translation: 'y',
    url: 'https://app.example/',
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses navigator.share when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })

    await shareVerse(payload)

    expect(share).toHaveBeenCalledWith({
      title: 'ASAR Sanctuary',
      text: formatVerseShareText(payload),
      url: payload.url.trim(),
    })
  })

  it('opens WhatsApp when share is missing', async () => {
    const open = vi.fn()
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('open', open)

    await shareVerse(payload)

    expect(open).toHaveBeenCalledTimes(1)
    const [url] = open.mock.calls[0] as [string]
    expect(url.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(formatVerseShareText(payload))
  })

  it('falls back to WhatsApp on share rejection (non-abort)', async () => {
    const share = vi.fn().mockRejectedValue(new Error('not allowed'))
    const open = vi.fn()
    vi.stubGlobal('navigator', { share })
    vi.stubGlobal('open', open)

    await shareVerse(payload)

    expect(open).toHaveBeenCalled()
  })

  it('swallows AbortError from share', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'))
    const open = vi.fn()
    vi.stubGlobal('navigator', { share })
    vi.stubGlobal('open', open)

    await shareVerse(payload)

    expect(open).not.toHaveBeenCalled()
  })
})
