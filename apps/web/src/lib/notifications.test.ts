import { describe, expect, it } from 'vitest';
import type { NotificationDto } from '@tecpap/types';
import { resolveNotificationText } from './notifications';

function notification(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'n1', type: 'CAPA_VALIDATED', category: 'capa', severity: 'SUCCESS',
    title: 'CAPA validated: CAPA-2026-0001', message: 'Spill containment passed verification and is now validated.',
    params: { reference: 'CAPA-2026-0001', title: 'Spill containment' },
    entityType: 'capa_verification', entityId: 'v1', actionUrl: '/capas/c1', departmentId: 'd1',
    readAt: null, archivedAt: null, createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('resolveNotificationText — Phase 5 localization', () => {
  it('renders CAPA_VALIDATED correctly in English', () => {
    const { title, message } = resolveNotificationText(notification(), 'en');
    expect(title).toBe('CAPA validated: CAPA-2026-0001');
    expect(message).toBe('Spill containment passed verification and is now validated.');
  });

  it('renders CAPA_VALIDATED correctly in French', () => {
    const { title, message } = resolveNotificationText(notification(), 'fr');
    expect(title).toBe('CAPA validée : CAPA-2026-0001');
    expect(message).toBe('Spill containment a réussi la vérification et est maintenant validée.');
  });

  it('renders CAPA_RETURNED correctly in English, including notes', () => {
    const n = notification({
      type: 'CAPA_RETURNED', title: 'CAPA returned for rework: CAPA-2026-0007', message: 'Line audit failed verification and requires rework.',
      params: { reference: 'CAPA-2026-0007', title: 'Line audit', notes: 'Missing evidence' },
    });
    const { title, message } = resolveNotificationText(n, 'en');
    expect(title).toBe('CAPA returned for rework: CAPA-2026-0007');
    expect(message).toBe('Line audit failed verification and requires rework.\nNotes: Missing evidence');
  });

  it('renders CAPA_RETURNED correctly in French, including notes', () => {
    const n = notification({
      type: 'CAPA_RETURNED', params: { reference: 'CAPA-2026-0007', title: 'Ligne audit', notes: 'Preuve manquante' },
    });
    const { title, message } = resolveNotificationText(n, 'fr');
    expect(title).toBe('CAPA retournée pour reprise : CAPA-2026-0007');
    expect(message).toBe('Ligne audit a échoué à la vérification et nécessite une reprise.\nNotes: Preuve manquante');
  });

  it('interpolates parameters correctly regardless of param order or extra params', () => {
    const n = notification({ type: 'CAPA_ASSIGNED', params: { reference: 'CAPA-2026-0099', findingTitle: 'Oil leak on line 3' } });
    const { title, message } = resolveNotificationText(n, 'en');
    expect(title).toBe('CAPA assigned: CAPA-2026-0099');
    expect(message).toBe('Oil leak on line 3 — corrective action required.');
  });

  it('renders a legacy notification (no params) from its stored title/message, unchanged by locale', () => {
    const legacy = notification({ params: null, title: 'Legacy title', message: 'Legacy message' });
    expect(resolveNotificationText(legacy, 'en')).toEqual({ title: 'Legacy title', message: 'Legacy message' });
    expect(resolveNotificationText(legacy, 'fr')).toEqual({ title: 'Legacy title', message: 'Legacy message' });
  });

  it('falls back gracefully to stored title/message when the type has no registered template', () => {
    const n = notification({ type: 'SYSTEM', params: { anything: 'x' }, title: 'System notice', message: 'Something happened' });
    expect(resolveNotificationText(n, 'fr')).toEqual({ title: 'System notice', message: 'Something happened' });
  });

  it('action URL is untouched by localization (still resolvable by the caller)', () => {
    const n = notification({ actionUrl: '/capas/xyz' });
    expect(n.actionUrl).toBe('/capas/xyz');
    resolveNotificationText(n, 'fr'); // rendering must not mutate or depend on actionUrl
    expect(n.actionUrl).toBe('/capas/xyz');
  });
});
