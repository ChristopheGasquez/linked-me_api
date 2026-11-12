import { ArgumentsHost, ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerLimitDetail } from '@nestjs/throttler';
import { CustomThrottlerGuard } from './throttler.guard.js';
import { HttpExceptionFilter } from '../filters/http-exception.filter.js';

// Exposes the protected method under test without booting the throttler module
class TestableThrottlerGuard extends CustomThrottlerGuard {
  throwFor(detail: Partial<ThrottlerLimitDetail>) {
    return this.throwThrottlingException(
      {} as ExecutionContext,
      detail as ThrottlerLimitDetail,
    );
  }
}

describe('CustomThrottlerGuard', () => {
  const guard = new TestableThrottlerGuard({} as any, {} as any, {} as any);

  const catchThrown = (timeToExpire: number): ThrottlerException => {
    try {
      void guard.throwFor({ timeToExpire });
    } catch (e) {
      return e as ThrottlerException;
    }
    throw new Error('expected a ThrottlerException');
  };

  it('should throw a ThrottlerException carrying code and retryAfter', () => {
    const exception = catchThrown(42);

    expect(exception).toBeInstanceOf(ThrottlerException);
    expect(exception.getStatus()).toBe(429);
    expect(JSON.parse(exception.getResponse() as string)).toEqual({
      message: 'Too Many Requests',
      code: 'throttle.too_many_requests',
      params: { retryAfter: 42 },
    });
  });

  it('should produce a normalized 429 body once caught by HttpExceptionFilter', () => {
    const response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(catchThrown(7), host);

    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 429,
      error: 'TOO_MANY_REQUESTS',
      message: 'Too Many Requests',
      code: 'throttle.too_many_requests',
      params: { retryAfter: 7 },
    });
  });
});
