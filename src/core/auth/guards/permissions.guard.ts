import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ResponseCodes } from '../../../common/constants/response-codes.js';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import type { CachedUser } from '../cache/user-cache.service.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndMerge<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: CachedUser }>();

    const granted = requiredPermissions.every((permission) =>
      user.permissions?.includes(permission),
    );
    if (!granted) {
      throw new ForbiddenException({
        message: 'Missing required permission(s)',
        code: ResponseCodes.AUTH_PERMISSION_DENIED,
      });
    }
    return true;
  }
}
