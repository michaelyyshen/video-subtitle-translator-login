import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  // Prefix `tw-` so any future `tailwind.config.js` merge with the extension
  // (where Tailwind is unlikely to be used) doesn't leak utility class names
  // into Chrome extension pages.
  theme: {
    extend: {
      colors: {
        // Mirror website/style.css custom properties.
        indigo: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed'
        },
        pink: {
          400: '#f472b6',
          500: '#ec4899'
        },
        amber: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706'
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669'
        },
        bg: '#07070c',
        'bg-soft': '#0c0c14',
        card: '#12121d',
        'card-hover': '#181828',
        ink: '#f5f5ff',
        'ink-muted': '#9797b3',
        'ink-dim': '#67677f',
        border: 'rgba(255, 255, 255, 0.08)',
        'border-strong': 'rgba(99, 102, 241, 0.35)'
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Manrope', 'Inter', 'sans-serif']
      },
      spacing: {
        // Fractional scale values that the existing CSS uses (4.5 = 1.125rem,
        // 5.5 = 1.375rem) and which aren't in Tailwind's default scale.
        4.5: '1.125rem',
        5.5: '1.375rem'
      },
      maxWidth: {
        container: '1160px'
      },
      boxShadow: {
        glow: '0 8px 24px -8px rgba(99, 102, 241, 0.6)',
        'glow-lg': '0 14px 32px -8px rgba(99, 102, 241, 0.85)',
        card: '0 18px 60px -30px rgba(99, 102, 241, 0.7)'
      },
      borderRadius: {
        sm: '10px',
        DEFAULT: '18px',
        lg: '24px'
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.16, 1, 0.3, 1)'
      }
    }
  },
  plugins: []
};

export default config;
