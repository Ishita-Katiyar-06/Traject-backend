/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },
        border: 'var(--color-border)',
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        signal: 'var(--color-signal)',
        data: 'var(--color-data)',
        critical: 'var(--color-critical)',
        confirmed: 'var(--color-confirmed)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        serif: ['"IBM Plex Serif"', 'ui-serif', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '12px',
        input: '14px',
        card: '26px',
        modal: '26px',
      },
      spacing: {
        1: '4px',
        2: '8px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      },
      transitionDuration: {
        DEFAULT: '180ms',
        fast: '150ms',
      },
      fontSize: {
        'page-title': ['28px', { lineHeight: '34px', letterSpacing: '-0.015em' }],
        'section-title': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        'body': ['14px', { lineHeight: '20px' }],
        'secondary': ['13px', { lineHeight: '18px' }],
        'small': ['12px', { lineHeight: '16px' }],
        'metric': ['26px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
      },
      zIndex: {
        header: '40',
        sidebar: '50',
        dropdown: '100',
        'modal-backdrop': '9990',
        modal: '9999',
        tooltip: '10000',
      },
    },
  },
  plugins: [],
}
