import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OriginGuard } from './origin.guard.js';

describe('OriginGuard', () => {
  const savedAdmin = process.env.ADMIN_ORIGINS;
  const savedApp = process.env.APP_ORIGINS;
  let reflector: Reflector;
  let guard: OriginGuard;

  const contextFor = (origin?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: origin === undefined ? {} : { origin } }),
      }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const adminOnly = (value: boolean | undefined) =>
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(value);

  beforeEach(() => {
    process.env.ADMIN_ORIGINS = 'https://admin.test';
    process.env.APP_ORIGINS = 'https://app1.test';
    reflector = new Reflector();
    guard = new OriginGuard(reflector);
  });

  afterAll(() => {
    process.env.ADMIN_ORIGINS = savedAdmin;
    process.env.APP_ORIGINS = savedApp;
  });

  it('should allow requests without an Origin header', () => {
    adminOnly(true);
    expect(guard.canActivate(contextFor())).toBe(true);
  });

  it('should allow admin and app origins on regular routes', () => {
    adminOnly(undefined);
    expect(guard.canActivate(contextFor('https://admin.test'))).toBe(true);
    expect(guard.canActivate(contextFor('https://app1.test'))).toBe(true);
  });

  it('should allow only admin origins on admin routes', () => {
    adminOnly(true);
    expect(guard.canActivate(contextFor('https://admin.test'))).toBe(true);
    expect(() => guard.canActivate(contextFor('https://app1.test'))).toThrow(
      ForbiddenException,
    );
  });

  it.each(['https://evil.test', 'null', ''])(
    'should reject the origin "%s" with origin.not_allowed',
    (origin) => {
      adminOnly(undefined);
      try {
        guard.canActivate(contextFor(origin));
        throw new Error('expected a ForbiddenException');
      } catch (e) {
        expect(e).toBeInstanceOf(ForbiddenException);
        expect((e as ForbiddenException).getResponse()).toEqual({
          message: 'Origin not allowed',
          code: 'origin.not_allowed',
        });
      }
    },
  );
});
