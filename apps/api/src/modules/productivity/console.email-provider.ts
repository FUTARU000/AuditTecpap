import { Injectable, Logger } from '@nestjs/common';
import type { EmailProvider, EmailMessage } from './email-provider.interface';

/** Default no-op provider: logs the would-be email. Swap for SMTP at the DI token. */
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailProvider');
  readonly key = 'console';

  async send(message: EmailMessage): Promise<void> {
    this.logger.log(`email → ${message.to} | ${message.subject}`);
  }
}
