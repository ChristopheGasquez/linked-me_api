import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthCookies, authCookieNames } from './auth-cookies.js';

const configWith = (values: Record<string, string> = {}) =>
  ({
    get: vi.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
  }) as unknown as ConfigService;

const mockResponse = () =>
  ({ cookie: vi.fn(), clearCookie: vi.fn() }) as unknown as Response & {
    cookie: ReturnType<typeof vi.fn>;
    clearCookie: ReturnType<typeof vi.fn>;
  };

const SECURE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

describe('authCookieNames', () => {
  it('should use the __Host- prefix only for secure cookies', () => {
    expect(authCookieNames(true)).toEqual({
      access: '__Host-access_token',
      refresh: '__Host-refresh_token',
    });
    expect(authCookieNames(false)).toEqual({
      access: 'access_token',
      refresh: 'refresh_token',
    });
  });
});

describe('AuthCookies', () => {
  it('should set the access cookie for 10 minutes by default', () => {
    const res = mockResponse();

    new AuthCookies(configWith()).setAccess(res, 'access');

    expect(res.cookie).toHaveBeenCalledWith('__Host-access_token', 'access', {
      ...SECURE_OPTIONS,
      maxAge: 10 * 60 * 1000,
    });
  });

  it('should set the refresh cookie for REFRESH_TOKEN_TTL_DAYS', () => {
    const res = mockResponse();

    new AuthCookies(configWith({ REFRESH_TOKEN_TTL_DAYS: '2' })).setRefresh(
      res,
      'refresh',
    );

    expect(res.cookie).toHaveBeenCalledWith('__Host-refresh_token', 'refresh', {
      ...SECURE_OPTIONS,
      maxAge: 2 * 24 * 60 * 60 * 1000,
    });
  });

  it('should use ACCESS_TOKEN_TTL_MINUTES for the access cookie', () => {
    const res = mockResponse();

    new AuthCookies(configWith({ ACCESS_TOKEN_TTL_MINUTES: '5' })).setAccess(
      res,
      'access',
    );

    expect(res.cookie).toHaveBeenCalledWith(
      '__Host-access_token',
      'access',
      expect.objectContaining({ maxAge: 5 * 60 * 1000 }),
    );
  });

  it('should drop Secure and the prefix when COOKIE_SECURE=false', () => {
    const res = mockResponse();

    new AuthCookies(configWith({ COOKIE_SECURE: 'false' })).setAccess(
      res,
      'access',
    );

    expect(res.cookie).toHaveBeenCalledWith(
      'access_token',
      'access',
      expect.objectContaining({ secure: false }),
    );
  });

  it('should clear both cookies with the same attributes', () => {
    const res = mockResponse();

    new AuthCookies(configWith()).clear(res);

    expect(res.clearCookie).toHaveBeenCalledWith(
      '__Host-access_token',
      SECURE_OPTIONS,
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      '__Host-refresh_token',
      SECURE_OPTIONS,
    );
  });

  it('should read the refresh cookie, undefined without cookies', () => {
    const cookies = new AuthCookies(configWith());

    expect(
      cookies.readRefresh({
        cookies: { '__Host-refresh_token': 'refresh' },
      } as unknown as Request),
    ).toBe('refresh');
    expect(cookies.readRefresh({} as Request)).toBeUndefined();
  });
});
