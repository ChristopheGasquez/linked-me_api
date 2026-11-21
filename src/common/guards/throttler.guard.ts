import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  ThrottlerGuard,
  ThrottlerLimitDetail,
  ThrottlerException,
} from '@nestjs/throttler';
import { ResponseCodes } from '../constants/response-codes.js';
import { getClientIp } from '../network/client-ip.js';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    return Promise.resolve(getClientIp(req) ?? '');
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
