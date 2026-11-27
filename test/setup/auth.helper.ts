import request from 'supertest';
import type { TestApp } from './app.factory.js';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

export const DEFAULT_PASSWORD = 'Password-123!';

let counter = 0;
/** Unique email per call, so tests never collide. */
export const uniqueEmail = (prefix = 'user'): string =>
  `${prefix}.${Date.now()}.${++counter}@test.local`;

export const ACCESS_COOKIE = '__Host-access_token';
export const REFRESH_COOKIE = '__Host-refresh_token';

/** Access cookie: request(t.http).get('/x').set(authCookie(token)) */
export const authCookie = (accessToken: string) => ({
  Cookie: `${ACCESS_COOKIE}=${accessToken}`,
});

/** Refresh cookie: request(t.http).post('/auth/refresh').set(refreshCookie(token)) */
export const refreshCookie = (refreshToken: string) => ({
  Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
});

/** Both cookies, as a browser sends them */
export const sessionCookies = (tokens: {
  accessToken: string;
  refreshToken: string;
}) => ({
  Cookie: `${ACCESS_COOKIE}=${tokens.accessToken}; ${REFRESH_COOKIE}=${tokens.refreshToken}`,
});

/** Set-Cookie lines of a response, by cookie name */
export function setCookies(res: request.Response): Record<string, string> {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries(
    (raw ?? []).map((line) => [line.slice(0, line.indexOf('=')), line]),
  );
}

/** Value of a cookie set by a response (undefined if not set) */
export function cookieValue(
  res: request.Response,
  name: string,
): string | undefined {
  const line = setCookies(res)[name];
  if (!line) return undefined;
  return decodeURIComponent(line.slice(name.length + 1).split(';')[0]);
}

export async function login(
  t: TestApp,
  email: string,
  password: string,
): Promise<AuthTokens> {
  const res = await request(t.http)
    .post('/auth/login')
    .send({ email, password })
    .expect(201);
  return {
    accessToken: cookieValue(res, ACCESS_COOKIE)!,
    refreshToken: cookieValue(res, REFRESH_COOKIE)!,
    userId: res.body.user.id,
  };
}

export const loginAsAdmin = (t: TestApp): Promise<AuthTokens> =>
  login(t, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

/**
 * Goes through the real API: register → verification mail (captured)
 * → verify-email → login. Returns the credentials and tokens.
 */
export async function createVerifiedUser(
  t: TestApp,
  overrides: { email?: string; password?: string; name?: string } = {},
): Promise<AuthTokens & { email: string; password: string }> {
  const email = overrides.email ?? uniqueEmail();
  const password = overrides.password ?? DEFAULT_PASSWORD;

  await request(t.http)
    .post('/auth/register')
    .send({ email, password, name: overrides.name ?? 'Test User' })
    .expect(201);

  const token = t.mail.lastToken(email, 'verification');
  await request(t.http).get('/auth/verify-email').query({ token }).expect(200);

  return { email, password, ...(await login(t, email, password)) };
}
