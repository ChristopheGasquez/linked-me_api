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

  trackerOf(req: Record<string, any>) {
    return this.getTracker(req);
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
    const response = { status: vi.fn(), json: vi.fn() };
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

  describe('getTracker()', () => {
    afterEach(() => {
      delete process.env.CLIENT_IP_HEADER;
    });

    const req = (headers: Record<string, unknown> = {}) => ({
      ip: '100.64.0.5',
      headers,
    });

    it('should use req.ip when CLIENT_IP_HEADER is unset, ignoring headers', async () => {
      await expect(
        guard.trackerOf(req({ 'x-real-ip': '203.0.113.9' })),
      ).resolves.toBe('100.64.0.5');
    });

    it('should use the configured header (name case-insensitive)', async () => {
      process.env.CLIENT_IP_HEADER = ' X-Real-IP ';
      await expect(
        guard.trackerOf(req({ 'x-real-ip': ' 203.0.113.9 ' })),
      ).resolves.toBe('203.0.113.9');
    });

    it('should fall back to req.ip when the header is missing or empty', async () => {
      process.env.CLIENT_IP_HEADER = 'x-real-ip';
      await expect(guard.trackerOf(req())).resolves.toBe('100.64.0.5');
      await expect(guard.trackerOf(req({ 'x-real-ip': ' ' }))).resolves.toBe(
        '100.64.0.5',
      );
      await expect(guard.trackerOf({ ip: '100.64.0.5' })).resolves.toBe(
        '100.64.0.5',
      );
    });

    it('should fall back to req.ip when the header is not a string', async () => {
      process.env.CLIENT_IP_HEADER = 'x-real-ip';
      await expect(
        guard.trackerOf(req({ 'x-real-ip': ['1.1.1.1', '2.2.2.2'] })),
      ).resolves.toBe('100.64.0.5');
    });
  });
});
