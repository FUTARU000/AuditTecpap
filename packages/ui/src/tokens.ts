/**
 * Design tokens as TS constants (for programmatic use, e.g. charts, canvas).
 * The Tailwind theme (packages/ui/tailwind-preset.js) and CSS variables
 * (packages/ui/src/styles/tokens.css) are the primary consumers in styling.
 *
 * Brand: Deep Brown (primary) · Leaf Green (secondary) · White (canvas) — SAD §14.
 */

export const brand = {
  brown: {
    50: '#F7F2EE',
    100: '#EDE2D9',
    200: '#DBC5B3',
    300: '#C4A285',
    400: '#A87C58',
    500: '#7A5638',
    600: '#5C4028',
    700: '#4A3728', // primary
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
    600: '#5B8A1E', // secondary
    700: '#4A6E17',
    800: '#3C5815',
    900: '#324A16',
    950: '#1A280A',
  },
  neutral: {
    50: '#FAF9F7',
    100: '#F4F2EF',
    200: '#E7E2DB',
    300: '#D5CDC2',
    400: '#B3A89A',
    500: '#948877',
    600: '#7A6F60',
    700: '#6B6259',
    800: '#4A423B',
    900: '#241C15',
  },
} as const;

export const severity = {
  critical: '#C62828',
  major: '#EF6C00',
  minor: '#B8860B',
  observation: '#546E7A',
} as const;

export const status = {
  success: '#2E7D32',
  info: '#1565C0',
  warning: '#8D6E63',
  danger: '#C62828',
} as const;

export const fontFamily = {
  sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
  mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
} as const;

export const radius = {
  sm: '0.375rem',
  md: '0.5rem',
  lg: '0.625rem',
  pill: '9999px',
} as const;

export const shadows = {
  sm: '0 1px 2px 0 rgb(36 28 21 / 0.04)',
  md: '0 2px 8px -2px rgb(36 28 21 / 0.08)',
  lg: '0 8px 24px -6px rgb(36 28 21 / 0.12)',
} as const;
