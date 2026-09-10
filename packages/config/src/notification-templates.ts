/**
 * Phase 5 — centralized EN/FR notification content.
 *
 * Single source of truth for notification text, shared by the API (which
 * renders the English fallback stored in `Notification.title`/`message` and
 * used for the email body) and the web app (which re-renders the active
 * locale at read time from `Notification.type` + `Notification.params`).
 * This is deliberately separate from `apps/web`'s UI-chrome dictionary
 * (static labels/buttons) — notification content is dynamic, parameterized,
 * and needed on both sides of the monorepo, so it lives in this shared
 * package rather than being duplicated in each app.
 *
 * Add a new type here when a producer needs one; there is no requirement to
 * cover every `NotificationType` — a type with no entry (or a notification
 * with no `params`) always falls back to its stored literal text.
 */

export type NotificationLocale = 'en' | 'fr';

export interface NotificationTemplateText {
  title: string;
  message: string;
}

export type NotificationTemplateParams = Record<string, string | number | boolean | undefined>;

type NotificationTemplateEntry = NotificationTemplateText | ((params: NotificationTemplateParams) => NotificationTemplateText);

type NotificationTemplateCatalog = Partial<Record<string, Record<NotificationLocale, NotificationTemplateEntry>>>;

/** `{key}` substitution — missing/undefined params render as an empty string. */
function interpolate(template: string, params: NotificationTemplateParams): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export const NOTIFICATION_TEMPLATES: NotificationTemplateCatalog = {
  CAPA_ASSIGNED: {
    en: { title: 'CAPA assigned: {reference}', message: '{findingTitle} — corrective action required.' },
    fr: { title: 'CAPA assignée : {reference}', message: '{findingTitle} — action corrective requise.' },
  },
  CAPA_RETURNED: {
    en: { title: 'CAPA returned for rework: {reference}', message: '{title} failed verification and requires rework.' },
    fr: { title: 'CAPA retournée pour reprise : {reference}', message: '{title} a échoué à la vérification et nécessite une reprise.' },
  },
  CAPA_VALIDATED: {
    en: { title: 'CAPA validated: {reference}', message: '{title} passed verification and is now validated.' },
    fr: { title: 'CAPA validée : {reference}', message: '{title} a réussi la vérification et est maintenant validée.' },
  },
  CAPA_DUE: {
    en: { title: 'CAPA due soon: {reference}', message: '{title} is due {dueDate}.' },
    fr: { title: 'CAPA à échéance proche : {reference}', message: '{title} est à rendre le {dueDate}.' },
  },
  CAPA_OVERDUE: {
    en: { title: 'CAPA overdue: {reference}', message: '{title} is past its target date.' },
    fr: { title: 'CAPA en retard : {reference}', message: '{title} a dépassé sa date cible.' },
  },
  AUDIT_STARTING_SOON: {
    en: { title: 'Audit starting soon: {title}', message: 'Scheduled {scheduledDate}.' },
    fr: { title: 'Audit bientôt programmé : {title}', message: 'Prévu le {scheduledDate}.' },
  },
  AUDIT_OVERDUE: {
    en: { title: 'Audit overdue: {title}', message: 'This audit was scheduled in the past and is not complete.' },
    fr: { title: 'Audit en retard : {title}', message: "Cet audit était prévu dans le passé et n'est pas terminé." },
  },
  DOCUMENT_AWAITING_APPROVAL: {
    en: { title: 'Document awaiting approval: {code}', message: '{title} ({departmentName}) uploaded by a Pilot — review required.' },
    fr: { title: 'Document en attente d\'approbation : {code}', message: '{title} ({departmentName}) déposé par un Pilote — vérification requise.' },
  },
  DOCUMENT_APPROVED: {
    en: (p) => ({
      title: interpolate(`Document ${p.action === 'published' ? 'published' : 'approved'}: {code}`, p),
      message: interpolate(`{title} has been ${p.action === 'published' ? 'published' : 'approved'} and is now available.`, p),
    }),
    fr: (p) => ({
      title: interpolate(`Document ${p.action === 'published' ? 'publié' : 'approuvé'} : {code}`, p),
      message: interpolate(`{title} a été ${p.action === 'published' ? 'publié' : 'approuvé'} et est maintenant disponible.`, p),
    }),
  },
  DOCUMENT_REJECTED: {
    en: { title: 'Document rejected: {code}', message: '{title} was rejected. Please review and resubmit.' },
    fr: { title: 'Document rejeté : {code}', message: '{title} a été rejeté. Veuillez le revoir et le soumettre à nouveau.' },
  },
  DOCUMENT_REVIEW_OVERDUE: {
    en: { title: 'Review overdue: {code}', message: '{title} is past its review date and needs re-review.' },
    fr: { title: 'Révision en retard : {code}', message: '{title} a dépassé sa date de révision et doit être réexaminé.' },
  },
  CERTIFICATE_EXPIRING: {
    en: (p) =>
      p.expired
        ? { title: interpolate('Document EXPIRED: {code}', p), message: interpolate('{title} — {deptName} / {catName} — expired {expirationDate}. Renewal required.', p) }
        : { title: interpolate('Document expiring in {days} days: {code}', p), message: interpolate('{title} — {deptName} / {catName} — expires {expirationDate}.', p) },
    fr: (p) =>
      p.expired
        ? { title: interpolate('Document EXPIRÉ : {code}', p), message: interpolate('{title} — {deptName} / {catName} — expiré le {expirationDate}. Renouvellement requis.', p) }
        : { title: interpolate('Document expirant dans {days} jours : {code}', p), message: interpolate('{title} — {deptName} / {catName} — expire le {expirationDate}.', p) },
  },
  KPI_THRESHOLD_EXCEEDED: {
    en: { title: 'KPI threshold breached: {name}', message: 'Current {currentValue}{unit} crossed the critical threshold ({criticalThreshold}).' },
    fr: { title: 'Seuil KPI dépassé : {name}', message: 'La valeur actuelle {currentValue}{unit} a franchi le seuil critique ({criticalThreshold}).' },
  },
  IMPORT_REQUIRES_REVIEW: {
    en: { title: 'Import awaiting review: {name}', message: 'Imported files are waiting for review and approval.' },
    fr: { title: 'Import en attente de vérification : {name}', message: 'Les fichiers importés attendent vérification et approbation.' },
  },
};

/**
 * Renders the notification text for `type` in `locale` from `params`.
 * Returns `null` when there is no template for this type — callers must fall
 * back to the notification's stored literal `title`/`message` in that case.
 * Also appends a standardized "Notes: {notes}" line when `params.notes` is
 * present, so any templated type can carry an optional free-text remark
 * without every template having to declare its own notes placeholder.
 */
export function renderNotification(type: string, locale: NotificationLocale, params: NotificationTemplateParams = {}): NotificationTemplateText | null {
  const entry = NOTIFICATION_TEMPLATES[type]?.[locale];
  if (!entry) return null;
  const base = typeof entry === 'function' ? entry(params) : { title: interpolate(entry.title, params), message: interpolate(entry.message, params) };
  if (params.notes) {
    // TECPAP terminology: "Notes" is used identically in French elsewhere in
    // the app (see apps/web/src/lib/i18n/dictionaries.ts: 'capa.notes').
    return { ...base, message: `${base.message}\nNotes: ${params.notes}` };
  }
  return base;
}
