import type { Mock } from 'vitest';
import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { HttpExceptionFilter } from './http-exception.filter.js';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  let response: { status: Mock; json: Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    response = { status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;
  });

  const bodyOf = (exception: HttpException) => {
    filter.catch(exception, host);
    return response.json.mock.calls[0][0];
  };

  it('should normalize an object response with message, code and params', () => {
    const body = bodyOf(
      new BadRequestException({
        message: 'Callback URL not allowed',
        code: 'auth.callback_url.not_allowed',
        params: { field: 'callbackUrl' },
      }),
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(body).toEqual({
      statusCode: 400,
      error: 'BAD_REQUEST',
      message: 'Callback URL not allowed',
      code: 'auth.callback_url.not_allowed',
      params: { field: 'callbackUrl' },
    });
  });

  it('should omit code and params when they are not provided', () => {
    const body = bodyOf(new NotFoundException({ message: 'Not here' }));

    expect(body).toEqual({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Not here',
    });
  });

  it('should fall back to the error text when the message is missing', () => {
    const body = bodyOf(new HttpException({ code: 'some.code' }, 403));

    expect(body).toEqual({
      statusCode: 403,
      error: 'FORBIDDEN',
      message: 'FORBIDDEN',
      code: 'some.code',
    });
  });

  it('should parse and normalize a JSON string response (throttler case)', () => {
    const body = bodyOf(
      new ThrottlerException(
        JSON.stringify({
          message: 'Too Many Requests',
          code: 'throttle.too_many_requests',
          params: { retryAfter: 42 },
        }),
      ),
    );

    expect(response.status).toHaveBeenCalledWith(429);
    expect(body).toEqual({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: 'Too Many Requests',
      code: 'throttle.too_many_requests',
      params: { retryAfter: 42 },
    });
  });

  it('should keep a plain string response as the message', () => {
    const body = bodyOf(new HttpException('Plain failure', 400));

    expect(body).toEqual({
      statusCode: 400,
      message: 'Plain failure',
      error: 'BAD_REQUEST',
    });
  });
});
