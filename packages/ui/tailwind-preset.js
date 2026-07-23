/**
 * Tailwind preset — the TECPAP design system as code.
 * Web app: `presets: [require('@tecpap/ui/tailwind-preset')]`
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Fixed brand scales (hex) for charts / explicit use
        brand: {
          brown: {
            50: '#F7F2EE',
            100: '#EDE2D9',
            200: '#DBC5B3',
            300: '#C4A285',
            400: '#A87C58',
            500: '#7A5638',
            600: '#5C4028',
            700: '#4A3728',
            800: '#3A2A1E',
            900: '#2A1E15',
            950: '#1A130D',
          },
          green: {
            50: '#F3F8E8',
            100: '#E2EFCB',
            200: '#C6E09A',
            300: '#A4CE63',
            400: '#86B93A',
            500: '#6BA323',
            600: '#5B8A1E',
            700: '#4A6E17',
            800: '#3C5815',
            900: '#324A16',
            950: '#1A280A',
          },
        },
        severity: {
          critical: '#C62828',
          major: '#EF6C00',
          minor: '#B8860B',
          observation: '#546E7A',
        },
        status: {
          success: '#2E7D32',
          info: '#1565C0',
          warning: '#8D6E63',
          danger: '#C62828',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(36 28 21 / 0.04)',
        md: '0 2px 8px -2px rgb(36 28 21 / 0.08)',
        lg: '0 8px 24px -6px rgb(36 28 21 / 0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateY(4px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'slide-in': 'slide-in 200ms ease-out',
      },
    },
  },
};
