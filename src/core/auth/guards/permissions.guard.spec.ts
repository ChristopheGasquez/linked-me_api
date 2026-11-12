import { Controller, ExecutionContext, Get } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard.js';
import { RequirePermissions } from '../decorators/permissions.decorator.js';
import { Permission } from '../permissions.constants.js';

const P1 = 'perm:one' as Permission;
const P2 = 'perm:two' as Permission;

@Controller()
class OpenController {
  @Get()
  open() {}
}

@Controller()
class MethodController {
  @Get()
  @RequirePermissions(P1)
  guarded() {}
}

@Controller()
@RequirePermissions(P1)
class ClassAndMethodController {
  @Get()
  @RequirePermissions(P2)
  guarded() {}
}

const buildContext = (
  controller: new () => object,
  handler: string,
  user: { permissions?: string[] } | undefined,
): ExecutionContext =>
  ({
    getHandler: () => controller.prototype[handler],
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  const guard = new PermissionsGuard(new Reflector());

  it('should allow access when no permission is required', () => {
    const context = buildContext(OpenController, 'open', { permissions: [] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when the user has the required permission', () => {
    const context = buildContext(MethodController, 'guarded', {
      permissions: [P1],
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when the user lacks the required permission', () => {
    const context = buildContext(MethodController, 'guarded', {
      permissions: [P2],
    });

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should deny access without crashing when the user has no permissions array', () => {
    const context = buildContext(MethodController, 'guarded', {});

    expect(guard.canActivate(context)).toBe(false);
  });

  it('should require both class-level and method-level permissions', () => {
    expect(
      guard.canActivate(
        buildContext(ClassAndMethodController, 'guarded', {
          permissions: [P1, P2],
        }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        buildContext(ClassAndMethodController, 'guarded', {
          permissions: [P2],
        }),
      ),
    ).toBe(false);
    expect(
      guard.canActivate(
        buildContext(ClassAndMethodController, 'guarded', {
          permissions: [P1],
        }),
      ),
    ).toBe(false);
  });
});
