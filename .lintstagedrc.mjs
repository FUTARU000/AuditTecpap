export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [
    'pnpm exec eslint --fix',
    'pnpm exec prettier --write',
  ],
  '*.{json,css,md,yml,yaml}': [
    'pnpm exec prettier --write',
  ],
};