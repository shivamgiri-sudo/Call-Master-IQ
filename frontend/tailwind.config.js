/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Surfaces (deep navy → graphite → near-black)
        base: '#06080C',
        panel: '#0B1018',
        elevated: '#111726',
        raised: '#172033',
        // Borders
        line: {
          subtle: 'rgba(255,255,255,0.06)',
          default: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
        },
        // Text
        ink: {
          primary: '#F4F6FB',
          secondary: '#B6BCCB',
          muted: '#6F7787',
        },
        // Semantic accents — used sparingly
        good: '#34D399',
        warn: '#FBBF24',
        bad: '#F87171',
        // Intelligence accents
        blue: '#5B9BFF',
        cyan: '#38E1FF',
        violet: '#9D7BFF',
        // Source badges
        finnable: '#9D7BFF',
        generic: '#38E1FF',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        glass: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.32)',
        'glass-lg': '0 1px 0 rgba(255,255,255,0.05) inset, 0 24px 64px rgba(0,0,0,0.48)',
        glow: '0 0 0 1px rgba(91,155,255,0.18), 0 0 32px rgba(91,155,255,0.10)',
        'glow-violet': '0 0 0 1px rgba(157,123,255,0.22), 0 0 32px rgba(157,123,255,0.12)',
      },
      backdropBlur: {
        glass: '14px',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};