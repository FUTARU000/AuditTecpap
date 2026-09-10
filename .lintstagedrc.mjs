import path from 'node:path';

// ESLint is only a devDependency of individual workspaces, not of the repo
// root, so `pnpm exec eslint` at the root can never resolve it. Route each
// staged file to its own workspace's eslint via `pnpm --dir <workspace>`,
// which resolves node_modules the same way that workspace's own `lint`
// script already does.
const WORKSPACES = ['apps/api', 'apps/web', 'packages/config', 'packages/types', 'packages/ui'];

function eslintPerWorkspace(filenames) {
  const root = process.cwd();
  const groups = new Map();
  for (const file of filenames) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const workspace = WORKSPACES.find((w) => rel.startsWith(`${w}/`));
    if (!workspace) continue; // no eslint applies (e.g. root-level config files)
    if (!groups.has(workspace)) groups.set(workspace, []);
    groups.get(workspace).push(file);
  }
  return [...groups.entries()].map(
    ([workspace, files]) =>
      `pnpm --dir ${workspace} exec eslint --fix ${files.map((f) => JSON.stringify(f)).join(' ')}`,
  );
}

export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [eslintPerWorkspace, 'pnpm exec prettier --write'],
  '*.{json,css,md,yml,yaml}': ['pnpm exec prettier --write'],
};
