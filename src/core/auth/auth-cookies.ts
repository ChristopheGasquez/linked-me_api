import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { MS_PER_DAY } from '../../common/constants.js';

export const authCookieNames = (secure: boolean) => {
  const prefix = secure ? '__Host-' : '';
  return { access: `${prefix}access_token`, refresh: `${prefix}refresh_token` };
};

export const isCookieSecure = (config: ConfigService) =>
  config.get<string>('COOKIE_SECURE', 'true') !== 'false';

export const accessTokenTtlSeconds = (config: ConfigService) =>
  Number(config.get('ACCESS_TOKEN_TTL_MINUTES', 10)) * 60;

@Injectable()
export class AuthCookies {
  private readonly secure: boolean;
  readonly names: { access: string; refresh: string };

  constructor(private config: ConfigService) {
    this.secure = isCookieSecure(config);
    this.names = authCookieNames(this.secure);
  }

  setAccess(res: Response, accessToken: string) {
    res.cookie(this.names.access, accessToken, {
      ...this.baseOptions(),
      maxAge: accessTokenTtlSeconds(this.config) * 1000,
    });
  }

  setRefresh(res: Response, refreshToken: string) {
    res.cookie(this.names.refresh, refreshToken, {
      ...this.baseOptions(),
      maxAge: Number(this.config.get('REFRESH_TOKEN_TTL_DAYS', 7)) * MS_PER_DAY,
    });
  }

  clear(res: Response) {
    res.clearCookie(this.names.access, this.baseOptions());
    res.clearCookie(this.names.refresh, this.baseOptions());
  }

  readRefresh(req: Request): string | undefined {
    return req.cookies?.[this.names.refresh] as string | undefined;
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: '/',
    };
  }
}
