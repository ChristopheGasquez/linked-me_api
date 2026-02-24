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
      HttpStatus[status as unknown as keyof typeof HttpStatus] ?? 'Internal Server Error';

    let body: Record<string, unknown>;

    if (typeof exceptionResponse === 'string') {
      body = { statusCode: status, message: exceptionResponse, error: errorText };
    } else {
      const { message, code, ...rest } = exceptionResponse as Record<string, unknown>;
      body = {
        statusCode: status,
        error: errorText,
        message: message ?? errorText,
        ...(code !== undefined && { code }),
        ...rest,
      };
    }

    response.status(status).json(body);
  }
}
