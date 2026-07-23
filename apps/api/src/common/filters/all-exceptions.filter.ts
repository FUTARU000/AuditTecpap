import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

interface ErrorDetail {
  field: string;
  issue: string;
}

/**
 * Global exception filter — shapes every error into the standard API envelope
 * (SAD §20.2) and attaches a request id for log correlation.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? randomUUID();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = isHttp ? exception.name : 'INTERNAL_ERROR';
    let message = isHttp ? exception.message : 'An unexpected error occurred.';
    let details: ErrorDetail[] | undefined;

    if (isHttp) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (typeof obj['code'] === 'string') code = obj['code'];
        if (Array.isArray(obj['message'])) {
          details = (obj['message'] as unknown[]).map((m) => ({
            field: '_',
            issue: String(m),
          }));
          message = 'Validation failed';
        } else if (typeof obj['message'] === 'string') {
          message = obj['message'];
        }
      }
    }

    const logMessage = `${request.method} ${request.url} → ${status} ${code} [${requestId}]`;
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? `${logMessage} :: ${exception.message}` : logMessage,
      );
    } else {
      this.logger.warn(logMessage);
    }

    response
      .status(status)
      .setHeader('x-request-id', requestId)
      .json({
        error: {
          code,
          message,
          ...(details ? { details } : {}),
          requestId,
        },
      });
  }
}
