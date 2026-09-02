import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

interface ErrorResponseBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  correlationId?: string;
}

// Catches everything (not just HttpException) so an unexpected error still
// produces the same normalized JSON shape instead of a Fastify default HTML
// error page or a raw stack trace leaking to the client.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, error, message } = this.resolve(exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      correlationId: request.id?.toString(),
    };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).send(body);
  }

  private resolve(exception: unknown): {
    status: number;
    error: string;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'object' && payload !== null) {
        const { message, error } = payload as { message?: string | string[]; error?: string };
        return {
          status,
          error: error ?? exception.name,
          message: message ?? exception.message,
        };
      }
      return { status, error: exception.name, message: String(payload) };
    }

    // Never leak internal error details (DB errors, stack traces, etc.) to
    // the client for anything that isn't a deliberate HttpException.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again later.',
    };
  }
}
