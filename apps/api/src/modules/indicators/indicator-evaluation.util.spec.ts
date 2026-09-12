import { describe, expect, it } from 'vitest';
import { evaluateIndicator } from './indicator-evaluation.util';

const base = { target: null, warningThreshold: null, criticalThreshold: null };

describe('evaluateIndicator', () => {
  it('returns NO_DATA when there is no recorded value, regardless of direction', () => {
    expect(evaluateIndicator({ ...base, direction: 'HIGHER_IS_BETTER', value: null })).toBe(
      'NO_DATA',
    );
    expect(evaluateIndicator({ ...base, direction: 'LOWER_IS_BETTER', value: null })).toBe(
      'NO_DATA',
    );
    expect(evaluateIndicator({ ...base, direction: 'TARGET_BASED', value: null })).toBe('NO_DATA');
  });

  it('returns ON_TARGET when no thresholds are configured at all, even with a value', () => {
    expect(evaluateIndicator({ ...base, direction: 'HIGHER_IS_BETTER', value: 5 })).toBe(
      'ON_TARGET',
    );
  });

  describe('HIGHER_IS_BETTER (thresholds are floors)', () => {
    const cfg = {
      direction: 'HIGHER_IS_BETTER' as const,
      target: null,
      warningThreshold: 80,
      criticalThreshold: 60,
    };
    it('CRITICAL when value is at or below the critical floor', () => {
      expect(evaluateIndicator({ ...cfg, value: 60 })).toBe('CRITICAL');
      expect(evaluateIndicator({ ...cfg, value: 40 })).toBe('CRITICAL');
    });
    it('WARNING when value is between critical and warning floors', () => {
      expect(evaluateIndicator({ ...cfg, value: 70 })).toBe('WARNING');
      expect(evaluateIndicator({ ...cfg, value: 80 })).toBe('WARNING');
    });
    it('ON_TARGET when value is above the warning floor', () => {
      expect(evaluateIndicator({ ...cfg, value: 95 })).toBe('ON_TARGET');
    });
  });

  describe('LOWER_IS_BETTER (thresholds are ceilings)', () => {
    const cfg = {
      direction: 'LOWER_IS_BETTER' as const,
      target: null,
      warningThreshold: 10,
      criticalThreshold: 20,
    };
    it('CRITICAL when value is at or above the critical ceiling', () => {
      expect(evaluateIndicator({ ...cfg, value: 20 })).toBe('CRITICAL');
      expect(evaluateIndicator({ ...cfg, value: 30 })).toBe('CRITICAL');
    });
    it('WARNING when value is between warning and critical ceilings', () => {
      expect(evaluateIndicator({ ...cfg, value: 10 })).toBe('WARNING');
      expect(evaluateIndicator({ ...cfg, value: 15 })).toBe('WARNING');
    });
    it('ON_TARGET when value is below the warning ceiling', () => {
      expect(evaluateIndicator({ ...cfg, value: 2 })).toBe('ON_TARGET');
    });
  });

  describe('TARGET_BASED (thresholds are maximum allowed deviation)', () => {
    const cfg = {
      direction: 'TARGET_BASED' as const,
      target: 100,
      warningThreshold: 5,
      criticalThreshold: 10,
    };
    it('CRITICAL when the absolute deviation reaches the critical band, above or below target', () => {
      expect(evaluateIndicator({ ...cfg, value: 110 })).toBe('CRITICAL');
      expect(evaluateIndicator({ ...cfg, value: 90 })).toBe('CRITICAL');
    });
    it('WARNING when the deviation is in the warning band', () => {
      expect(evaluateIndicator({ ...cfg, value: 106 })).toBe('WARNING');
      expect(evaluateIndicator({ ...cfg, value: 94 })).toBe('WARNING');
    });
    it('ON_TARGET when close enough to target', () => {
      expect(evaluateIndicator({ ...cfg, value: 101 })).toBe('ON_TARGET');
    });
    it('ON_TARGET when a value exists but no target is configured to deviate from', () => {
      expect(
        evaluateIndicator({
          direction: 'TARGET_BASED',
          target: null,
          warningThreshold: 5,
          criticalThreshold: 10,
          value: 500,
        }),
      ).toBe('ON_TARGET');
    });
  });
});
