import type { Config } from 'tailwindcss'

/** Tokens aligned with Stitch HTML exports (Nature Distilled). */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif"', 'Georgia', 'serif'],
        headline: ['"Noto Serif"', 'Georgia', 'serif'],
        /** Display / wordmark — high-end spaced serif */
        display: ['"Noto Serif"', 'Georgia', 'serif'],
        /** Mushaf: KFGQPC / Uthmanic Hafs via @font-face + Scheherazade fallback */
        quran: ['"Uthmanic HAFS"', '"Scheherazade New"', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        label: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#FDF2F0',
          bright: '#FDF2F0',
          dim: '#e2d8d6',
        },
        accent: {
          gold: '#D4AF37',
          'gold-glow': 'rgba(212, 175, 55, 0.5)',
        },
        'surface-container': {
          DEFAULT: '#f6ecea',
          low: '#fcf1ef',
          high: '#f1e6e4',
          highest: '#ebe0de',
          lowest: '#ffffff',
        },
        primary: {
          DEFAULT: '#003527',
          container: '#064e3b',
          fixed: '#b0f0d6',
          'fixed-dim': '#95d3ba',
          /** Semantic alias — brand emerald for wordmark */
          emerald: '#003527',
        },
        secondary: {
          DEFAULT: '#735c00',
          container: '#fed65b',
          fixed: '#ffe088',
          'fixed-dim': '#e9c349',
        },
        tertiary: {
          DEFAULT: '#003623',
          container: '#004f34',
          fixed: '#6ffbbe',
          'fixed-dim': '#4edea3',
        },
        outline: {
          DEFAULT: '#707974',
          variant: '#bfc9c3',
        },
        on: {
          surface: '#1f1a1a',
          primary: '#ffffff',
          secondary: '#ffffff',
          'surface-variant': '#404944',
          'primary-container': '#80bea6',
          'primary-fixed': '#002117',
          'primary-fixed-variant': '#0b513d',
          'secondary-container': '#745c00',
          'tertiary-container': '#31c98f',
          error: '#ffffff',
          'error-container': '#93000a',
        },
        error: {
          DEFAULT: '#ba1a1a',
          container: '#ffdad6',
        },
        inverse: {
          surface: '#352f2e',
          primary: '#95d3ba',
          'on-surface': '#f9eeec',
        },
        'surface-tint': '#2b6954',
        'surface-variant': '#ebe0de',
      },
      borderRadius: {
        bento: '1rem',
        pill: '9999px',
        stitch: '1.5rem',
      },
      boxShadow: {
        ambient: '0 12px 40px rgba(31, 26, 26, 0.06)',
        glass: '0 8px 32px rgba(31, 26, 26, 0.08)',
        'primary-soft': '0 25px 50px -12px rgba(0, 53, 39, 0.25)',
      },
    },
  },
  plugins: [],
} satisfies Config
