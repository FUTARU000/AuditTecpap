import { renderNotification } from '@tecpap/config';
import type { NotificationDto } from '@tecpap/types';
import type { Locale } from './i18n/dictionaries';

/**
 * Phase 5 — resolves the text to display for a notification in the given
 * locale. Prefers re-rendering `type` + `params` through the shared
 * notification template catalog (the same one the API uses to compose the
 * stored English fallback), so a French-speaking user sees French even
 * though the database always stores English. Falls back to the notification's
 * stored `title`/`message` when there are no params (legacy notifications
 * created before Phase 5) or when `type` has no registered template — this
 * fallback is what keeps every existing notification readable unchanged.
 */
export function resolveNotificationText(notification: NotificationDto, locale: Locale): { title: string; message: string } {
  if (notification.params) {
    const rendered = renderNotification(notification.type, locale, notification.params);
    if (rendered) return rendered;
  }
  return { title: notification.title, message: notification.message };
}
