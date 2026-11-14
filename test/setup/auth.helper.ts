import request from 'supertest';
import type { TestApp } from './app.factory.js';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  userId: number;
};

export const DEFAULT_PASSWORD = 'Password-123!';

let counter = 0;
/** Unique email per call, so tests never collide. */
export const uniqueEmail = (prefix = 'user'): string =>
  `${prefix}.${Date.now()}.${++counter}@test.local`;

/** Authorization header: request(t.http).get('/x').set(bearer(token)) */
export const bearer = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
});

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
    accessToken: res.body.access_token,
    refreshToken: res.body.refresh_token,
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
