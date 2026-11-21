import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerException,
} from '@nestjs/throttler';
import { ResponseCodes } from '../constants/response-codes.js';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  /**
   * Throttling key. Behind a proxy that overwrites a client-IP header
   * (Railway: X-Real-IP), CLIENT_IP_HEADER names it; otherwise req.ip.
   * Never point it at a header the client can set (e.g. X-Forwarded-For on Railway).
   */
  protected getTracker(req: Record<string, any>): Promise<string> {
    const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
    const headers = req.headers as Record<string, unknown> | undefined;
    const value = header ? headers?.[header] : undefined;
    const ip = typeof value === 'string' ? value.trim() : '';
    return Promise.resolve(ip || req.ip);
  }

  protected throwThrottlingException(
    _context: ExecutionContext,
    { timeToExpire }: ThrottlerLimitDetail,
  ): Promise<void> {
    throw new ThrottlerException(
      JSON.stringify({
        message: 'Too Many Requests',
        code: ResponseCodes.THROTTLE_TOO_MANY_REQUESTS,
        params: { retryAfter: timeToExpire },
      }),
    );
  }
}
