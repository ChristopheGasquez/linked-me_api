import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ResponseCodes } from '../../common/constants/response-codes.js';
import { getClientIp } from '../../common/network/client-ip.js';
import { TURNSTILE_HEADER } from './turnstile.constants.js';
import { TurnstileService } from './turnstile.service.js';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!this.turnstile.isEnabled()) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const raw = req.headers[TURNSTILE_HEADER];
    const token = typeof raw === 'string' ? raw.trim() : '';
    if (!token) {
      throw new BadRequestException({
        message: 'Captcha token missing',
        code: ResponseCodes.CAPTCHA_MISSING,
      });
    }
    if (!(await this.turnstile.verify(token, getClientIp(req)))) {
      throw new ForbiddenException({
        message: 'Captcha verification failed',
        code: ResponseCodes.CAPTCHA_INVALID,
      });
    }
    return true;
  }
}
