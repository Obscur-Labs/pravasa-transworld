import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Brand palette, sampled straight from the Pravasa Transworld logo ──
        // brand-900 (#0B2E3D) is the exact navy of the wordmark; gold-600 (#9F7437)
        // is the exact gold of the plane, pin and "TRANSWORLD" rule. The rest of each
        // ramp is the same hue held steady with the lightness stepped, so any shade
        // pairs cleanly with the artwork.
        brand: {
          50:  '#EFF7FB',
          100: '#DEEFF7',
          200: '#BFE0EE',
          300: '#94C9E0',
          400: '#61AFD1',
          500: '#3095C0',
          600: '#207497',
          700: '#165874',
          800: '#0F4157',
          900: '#0B2E3D',
          950: '#061E27',
        },
        gold: {
          50:  '#FCF8F3',
          100: '#F8EFE3',
          200: '#EEDCC4',
          300: '#DFC29A',
          400: '#CCA266',
          500: '#BE8A41',
          600: '#9F7437',
          700: '#825E2B',
          800: '#674B22',
          900: '#503A1B',
          950: '#322410',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        overlay: 'hsl(var(--overlay))',
        success: { DEFAULT: 'hsl(var(--success))', foreground: 'hsl(var(--success-foreground))' },
        warning: { DEFAULT: 'hsl(var(--warning))', foreground: 'hsl(var(--warning-foreground))' },
        info: { DEFAULT: 'hsl(var(--info))', foreground: 'hsl(var(--info-foreground))' },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
          6: 'hsl(var(--chart-6))',
        },
      },
      borderRadius: { xl: 'var(--radius)', lg: 'calc(var(--radius) - 2px)', md: 'calc(var(--radius) - 4px)', sm: 'calc(var(--radius) - 6px)' },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.04)',
        sm: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
        md: '0 4px 8px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
