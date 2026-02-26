import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorText =
      HttpStatus[status as unknown as keyof typeof HttpStatus] ??
      'Internal Server Error';

    let body: Record<string, unknown>;

    let parsed: Record<string, unknown> | null = null;
    if (typeof exceptionResponse === 'string') {
      try {
        parsed = JSON.parse(exceptionResponse) as Record<string, unknown>;
      } catch {
        // not JSON, treat as plain message
      }
    }

    if (parsed !== null) {
      const { message, code, params, ...rest } = parsed;
      body = {
        statusCode: status,
        error: errorText,
        message: message ?? errorText,
        ...(code !== undefined && { code }),
        ...(params !== undefined && { params }),
        ...rest,
      };
    } else if (typeof exceptionResponse === 'string') {
      body = {
        statusCode: status,
        message: exceptionResponse,
        error: errorText,
      };
    } else {
      const { message, code, params, ...rest } = exceptionResponse as Record<
        string,
        unknown
      >;
      body = {
        statusCode: status,
        error: errorText,
        message: message ?? errorText,
        ...(code !== undefined && { code }),
        ...(params !== undefined && { params }),
        ...rest,
      };
    }

    response.status(status).json(body);
  }
}
