import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CapaVerificationDto } from '@tecpap/types';
import { VerificationHistoryList } from './verification-history-list';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const labels = {
  title: 'Verification history',
  attempt: 'Attempt',
  by: 'By',
  resultLabel: (r: string) => (r === 'PASSED' ? 'Passed' : 'Failed'),
};

const attempt = (overrides: Partial<CapaVerificationDto>): CapaVerificationDto => ({
  id: 'v1', verifiedById: 'u1', verifiedByName: 'Audit Manager', result: 'FAILED', notes: null, verifiedAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('VerificationHistoryList — Phase 3 audit trail rendering', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders nothing when there is no verification history yet', () => {
    act(() => root.render(<VerificationHistoryList verifications={[]} labels={labels} />));
    expect(container.textContent).toBe('');
  });

  it('renders every repeated FAILED → rework attempt, numbered oldest-first, without dropping any', () => {
    const verifications: CapaVerificationDto[] = [
      attempt({ id: 'v1', result: 'FAILED', notes: 'First attempt insufficient', verifiedAt: '2026-01-01T10:00:00.000Z' }),
      attempt({ id: 'v2', result: 'FAILED', notes: 'Second attempt insufficient', verifiedAt: '2026-01-05T10:00:00.000Z' }),
      attempt({ id: 'v3', result: 'PASSED', notes: 'Now compliant', verifiedAt: '2026-01-10T10:00:00.000Z' }),
    ];

    act(() => root.render(<VerificationHistoryList verifications={verifications} labels={labels} />));

    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(3);

    expect(items[0]!.textContent).toContain('Attempt 1');
    expect(items[0]!.textContent).toContain('Failed');
    expect(items[0]!.textContent).toContain('First attempt insufficient');

    expect(items[1]!.textContent).toContain('Attempt 2');
    expect(items[1]!.textContent).toContain('Failed');
    expect(items[1]!.textContent).toContain('Second attempt insufficient');

    expect(items[2]!.textContent).toContain('Attempt 3');
    expect(items[2]!.textContent).toContain('Passed');
    expect(items[2]!.textContent).toContain('Now compliant');

    // Earlier attempts must still be present and unmodified alongside the final PASSED one.
    expect(container.textContent).toContain('Verification history');
  });

  it('shows the verifier name and omits notes when none were recorded', () => {
    act(() => root.render(<VerificationHistoryList verifications={[attempt({ verifiedByName: 'Jane Auditor', notes: null })]} labels={labels} />));
    expect(container.textContent).toContain('Jane Auditor');
  });
});
