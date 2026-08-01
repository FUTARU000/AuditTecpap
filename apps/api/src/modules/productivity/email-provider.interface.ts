/**
 * Email provider abstraction. The NotificationService depends only on this
 * interface, so a real SMTP/transport provider can be dropped in (SMTP,
 * SES, SendGrid, …) without touching notification logic. No production SMTP
 * is wired here — the console provider logs deliveries for dev/verification.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
  /** Optional entity context for templates/auditing. */
  meta?: Record<string, unknown>;
}

export interface EmailProvider {
  readonly key: string;
  send(message: EmailMessage): Promise<void>;
}
