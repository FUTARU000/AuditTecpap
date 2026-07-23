import { base } from '@tecpap/eslint-config';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...base(),
  {
    rules: {
      // Decorator-driven DI frequently uses injected but seemingly unused ctor params.
      '@typescript-eslint/no-unused-vars': 'off',
      // Nest DI relies on value imports for emitDecoratorMetadata param types.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
];
