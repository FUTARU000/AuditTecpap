// @ts-check
/**
 * Shared ESLint flat-config factory for the TECPAP monorepo.
 *
 * Consumers compose this base with their own framework-specific config
 * (Next.js, NestJS, React). Keeps rules and ignores consistent everywhere.
 *
 * @returns {import('eslint').Linter.Config[]}
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';

export function base() {
  return [
    {
      ignores: [
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/*.config.{js,mjs,cjs,ts}',
        '**/{eslint,prettier,tailwind,postcss,components}.config.*',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        globals: {
          ...globals.node,
          ...globals.es2022,
        },
      },
      rules: {
        '@typescript-eslint/no-unused-vars': [
          'warn',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        '@typescript-eslint/consistent-type-imports': [
          'warn',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
        'prefer-const': 'error',
        eqeqeq: ['error', 'always'],
      },
    },
    eslintConfigPrettier,
  ];
}

/**
 * Config for React/Next frontends.
 * @returns {import('eslint').Linter.Config[]}
 */
export function react() {
  return [
    ...base(),
    {
      languageOptions: {
        globals: {
          ...globals.browser,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
      },
    },
  ];
}

export default base;
