import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CachedUser } from '../cache/user-cache.service.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CachedUser =>
    context.switchToHttp().getRequest<{ user: CachedUser }>().user,
);
