import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { IndicatorEvaluationStatus } from '@tecpap/types';
import { IndicatorStatusBadge } from './indicator-status-badge';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe('IndicatorStatusBadge', () => {
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

  const cases: [IndicatorEvaluationStatus, string][] = [
    ['ON_TARGET', 'On target'],
    ['WARNING', 'Warning'],
    ['CRITICAL', 'Critical'],
    ['NO_DATA', 'No data'],
  ];

  for (const [status, label] of cases) {
    it(`renders the "${label}" label for status ${status}`, () => {
      act(() => root.render(<IndicatorStatusBadge status={status} />));
      expect(container.textContent).toBe(label);
    });
  }
});
