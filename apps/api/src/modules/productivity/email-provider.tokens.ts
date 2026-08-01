/** DI token for the swappable email provider. */
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export type { EmailProvider, EmailMessage } from './email-provider.interface';
