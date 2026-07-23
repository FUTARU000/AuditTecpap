import { describe, expect, it } from 'vitest';

/**
 * E2E smoke test — verifies the Vitest e2e config runs.
 * Full HTTP e2e tests (booting the Nest app against a test database) are added
 * in feature phases.
 */
describe('e2e pipeline', () => {
  it('runs', () => {
    expect(true).toBe(true);
  });
});
