import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        brand: {
          // --brand-primary-rgb is injected at runtime by BrandingProvider;
          // falls back to #0B5FFF (11 95 255).  The <alpha-value> placeholder
          // makes `bg-brand-primary/90` etc. work correctly with Tailwind JIT.
          primary:   'rgb(var(--brand-primary-rgb, 11 95 255) / <alpha-value>)',
          accent:    'rgb(var(--brand-accent-rgb, 14 165 233) / <alpha-value>)',
          ink:       '#0A0F1C',
          50:        '#EEF3FF',
          100:       '#D4E2FF',
          200:       '#A9C4FF',
          600:       '#0B5FFF',
          700:       '#0950D4',
          800:       '#0741A9',
          900:       '#05307E',
        },
        // Semantic surface tokens
        surface: {
          DEFAULT:  'hsl(var(--surface))',
          secondary:'hsl(var(--surface-secondary))',
          tertiary: 'hsl(var(--surface-tertiary))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Arabic', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { opacity: '1' },
          '50%':       { opacity: '0.4' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
  ],
};

export default config;
