import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerLimitDetail, ThrottlerException } from '@nestjs/throttler';
import { ResponseCodes } from '../constants/response-codes.js';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
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
