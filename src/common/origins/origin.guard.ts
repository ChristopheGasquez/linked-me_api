import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ResponseCodes } from '../constants/response-codes.js';
import { ADMIN_ORIGIN_ONLY } from './admin-origin-only.decorator.js';
import { getAllowedOrigins } from './allowed-origins.js';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly origins = getAllowedOrigins();

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { origin } = context.switchToHttp().getRequest<Request>().headers;
    if (origin === undefined) return true;

    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_ORIGIN_ONLY,
      [context.getHandler(), context.getClass()],
    );
    const allowed = adminOnly ? this.origins.admin : this.origins.all;
    if (allowed.includes(origin)) return true;

    throw new ForbiddenException({
      message: 'Origin not allowed',
      code: ResponseCodes.ORIGIN_NOT_ALLOWED,
    });
  }
}
