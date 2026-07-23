import { FlatCompat } from '@eslint/eslintrc';
import { react } from '@tecpap/eslint-config';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  {
    ignores: [
      'next-env.d.ts',
      '.next/**',
      'out/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  // Shared TS + prettier rules (registers @typescript-eslint once)…
  ...react(),
  // …plus Next.js-specific rules. (Omit 'next/typescript' — it re-registers
  // the @typescript-eslint plugin and conflicts with the shared config above.)
  ...compat.extends('next/core-web-vitals'),
  {
    rules: {
      // Intentional: fonts are loaded via <link> to avoid build-time fetches.
      '@next/next/no-page-custom-font': 'off',
    },
  },
];
