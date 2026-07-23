import { describe, expect, it } from 'vitest';

/**
 * Smoke test — verifies the Vitest + jsdom + Vite React pipeline is wired up.
 * Real component tests arrive with feature phases.
 */
describe('vitest setup', () => {
  it('runs assertions', () => {
    expect(1 + 1).toBe(2);
  });
});
