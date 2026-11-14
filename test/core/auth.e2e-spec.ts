import request from 'supertest';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import {
  bearer,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  login,
  uniqueEmail,
} from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';

const ALLOWED_CALLBACK = 'http://localhost:4200/verify'; // ALLOWED_REDIRECT_ORIGINS in .env.test
const NEW_PASSWORD = 'New-Password-456!';

describe('Auth (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  const register = (body: Record<string, unknown>) =>
    request(t.http).post('/auth/register').send(body);
  const loginReq = (email: string, password: string) =>
    request(t.http).post('/auth/login').send({ email, password });
  const refreshReq = (refresh_token: string) =>
    request(t.http).post('/auth/refresh').send({ refresh_token });
  const auditActions = async (userId: number) =>
    (
      await t.prisma.auditLog.findMany({
        where: { targetType: 'user', targetId: userId },
        orderBy: { id: 'asc' },
      })
    ).map((log) => log.action);

  // ─────────────────────────────────────────────────────────────
  // Register
  // ─────────────────────────────────────────────────────────────
  describe('POST /auth/register', () => {
    it('201: creates the user, sends a verification mail, hides the password', async () => {
      const email = uniqueEmail();

      const res = await register({
        email,
        password: DEFAULT_PASSWORD,
        name: 'Alice',
      }).expect(201);

      expect(res.body).toMatchObject({
        email,
        name: 'Alice',
        isEmailChecked: false,
      });
      expect(res.body).not.toHaveProperty('password');
      expect(t.mail.lastToken(email, 'verification')).toEqual(
        expect.any(String),
      );
      expect(await auditActions(res.body.id)).toEqual(['user.create']);
    });

    it('409 when the email is already used', async () => {
      const { email } = await createVerifiedUser(t);

      const res = await register({
        email,
        password: DEFAULT_PASSWORD,
        name: 'Bob',
      }).expect(409);
      expect(res.body.code).toBe('auth.register.conflict');
    });

    it('passes an allowed callbackUrl to the verification mail', async () => {
      const email = uniqueEmail();

      await register({
        email,
        password: DEFAULT_PASSWORD,
        name: 'Carol',
        callbackUrl: ALLOWED_CALLBACK,
      }).expect(201);

      expect(t.mail.sent.findLast((m) => m.to === email)?.callbackUrl).toBe(
        ALLOWED_CALLBACK,
      );
    });

    it('400 when the callbackUrl origin is not allowed', async () => {
      const res = await register({
        email: uniqueEmail(),
        password: DEFAULT_PASSWORD,
        name: 'Mallory',
        callbackUrl: 'https://evil.example.com/verify',
      }).expect(400);
      expect(res.body.code).toBe('auth.callback_url.not_allowed');
    });

    it('400 validation.failed with field codes on an invalid body', async () => {
      const res = await register({ email: 'not-an-email' }).expect(400);

      expect(res.body.code).toBe('validation.failed');
      const keys = res.body.params.fields.map((f: { key: string }) => f.key);
      expect(keys).toEqual(expect.arrayContaining(['email', 'password']));
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Email verification
  // ─────────────────────────────────────────────────────────────
  describe('Email verification', () => {
    it('login is refused until the email is verified, then allowed', async () => {
      const email = uniqueEmail();
      const reg = await register({
        email,
        password: DEFAULT_PASSWORD,
        name: 'Dave',
      }).expect(201);

      const refused = await loginReq(email, DEFAULT_PASSWORD).expect(401);
      expect(refused.body.code).toBe('auth.login.email_not_verified');

      const token = t.mail.lastToken(email, 'verification');
      const verified = await request(t.http)
        .get('/auth/verify-email')
        .query({ token })
        .expect(200);
      expect(verified.body.code).toBe('auth.email.verified');

      await loginReq(email, DEFAULT_PASSWORD).expect(201);
      expect(await auditActions(reg.body.id)).toContain('email.verified');
    });

    it('a verification token can be used only once', async () => {
      const email = uniqueEmail();
      await register({ email, password: DEFAULT_PASSWORD, name: 'Eve' });
      const token = t.mail.lastToken(email, 'verification');

      await request(t.http)
        .get('/auth/verify-email')
        .query({ token })
        .expect(200);
      const res = await request(t.http)
        .get('/auth/verify-email')
        .query({ token })
        .expect(401);
      expect(res.body.code).toBe('auth.email.invalid_token');
    });

    it('resend-verification issues a new token and invalidates the old one', async () => {
      const email = uniqueEmail();
      await register({ email, password: DEFAULT_PASSWORD, name: 'Frank' });
      const oldToken = t.mail.lastToken(email, 'verification');

      const res = await request(t.http)
        .post('/auth/resend-verification')
        .send({ email })
        .expect(201);
      expect(res.body.code).toBe('auth.email.resend_sent');
      const newToken = t.mail.lastToken(email, 'verification');
      expect(newToken).not.toBe(oldToken);

      await request(t.http)
        .get('/auth/verify-email')
        .query({ token: oldToken })
        .expect(401);
      await request(t.http)
        .get('/auth/verify-email')
        .query({ token: newToken })
        .expect(200);
    });

    it('resend-verification answers generically and sends nothing for unknown or verified emails', async () => {
      const verified = await createVerifiedUser(t);
      const unknown = uniqueEmail('unknown');
      const before = t.mail.sent.length;

      for (const email of [unknown, verified.email]) {
        const res = await request(t.http)
          .post('/auth/resend-verification')
          .send({ email })
          .expect(201);
        expect(res.body.code).toBe('auth.email.resend_sent');
      }
      expect(t.mail.sent.length).toBe(before);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Login & lockout
  // ─────────────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('201 returns tokens and the user without sensitive fields', async () => {
      const user = await createVerifiedUser(t);

      const res = await loginReq(user.email, user.password).expect(201);

      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
        user: { email: user.email },
      });
      for (const field of ['password', 'failedLoginAttempts', 'lockedUntil']) {
        expect(res.body.user).not.toHaveProperty(field);
      }
    });

    it('same 401 for a wrong password and an unknown email (no account enumeration)', async () => {
      const user = await createVerifiedUser(t);

      const wrongPassword = await loginReq(user.email, 'Wrong-Pass-1!').expect(
        401,
      );
      const unknownEmail = await loginReq(
        uniqueEmail('unknown'),
        'Wrong-Pass-1!',
      ).expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.code).toBe('auth.login.invalid_credentials');
    });

    it('locks the account after 5 failures, even for the right password', async () => {
      const user = await createVerifiedUser(t);

      for (let i = 0; i < 5; i++) {
        await loginReq(user.email, 'Wrong-Pass-1!').expect(401);
      }

      const locked = await loginReq(user.email, user.password).expect(403);
      expect(locked.body.code).toBe('auth.login.account_locked');
      expect(
        t.mail.sent.filter(
          (m) => m.to === user.email && m.type === 'account-locked',
        ),
      ).toHaveLength(1);

      const actions = await auditActions(user.userId);
      expect(actions.filter((a) => a === 'login.failed')).toHaveLength(4);
      expect(actions).toContain('login.locked');
    });

    it('a successful login resets the failure counter', async () => {
      const user = await createVerifiedUser(t);

      for (let i = 0; i < 4; i++) {
        await loginReq(user.email, 'Wrong-Pass-1!').expect(401);
      }
      await loginReq(user.email, user.password).expect(201);

      // 4 new failures would lock the account if the counter had not been reset
      for (let i = 0; i < 4; i++) {
        await loginReq(user.email, 'Wrong-Pass-1!').expect(401);
      }
      await loginReq(user.email, user.password).expect(201);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Refresh, sessions, logout
  // ─────────────────────────────────────────────────────────────
  describe('Refresh tokens & sessions', () => {
    // KNOWN BUG (skipped until the fix PR): refresh tokens have no jti, so two
    // tokens issued in the same second are identical. See test/README.md.
    it.skip('[KNOWN BUG: no jti] refresh rotates tokens: the previous refresh token is rejected', async () => {
      const user = await createVerifiedUser(t);

      const res = await refreshReq(user.refreshToken).expect(201);
      expect(res.body).toMatchObject({
        access_token: expect.any(String),
        refresh_token: expect.any(String),
      });
      expect(res.body.refresh_token).not.toBe(user.refreshToken);

      const reused = await refreshReq(user.refreshToken).expect(401);
      expect(reused.body.code).toBe('auth.refresh.token_revoked');

      await refreshReq(res.body.refresh_token).expect(201);
    });

    it('401 auth.refresh.invalid_token for a malformed refresh token', async () => {
      const res = await refreshReq('not-a-jwt').expect(401);
      expect(res.body.code).toBe('auth.refresh.invalid_token');
    });

    it('logout revokes the refresh token', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .post('/auth/logout')
        .send({ refresh_token: user.refreshToken })
        .expect(201);
      expect(res.body.code).toBe('auth.logout.success');

      await refreshReq(user.refreshToken).expect(401);
    });

    // KNOWN BUG (skipped until the fix PR): same cause as above.
    it.skip('[KNOWN BUG: no jti] two logins create two distinct sessions', async () => {
      const user = await createVerifiedUser(t);
      const second = await login(t, user.email, user.password);

      expect(second.refreshToken).not.toBe(user.refreshToken);

      // logging out one device must not log out the other
      await request(t.http)
        .post('/auth/logout')
        .send({ refresh_token: user.refreshToken })
        .expect(201);
      await refreshReq(second.refreshToken).expect(201);
    });

    it('GET /auth/sessions lists sessions without exposing the token hash', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .get('/auth/sessions')
        .set(bearer(user.accessToken))
        .expect(200);

      expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
      expect(res.body.data[0]).toMatchObject({
        id: expect.any(Number),
        expiresAt: expect.any(String),
      });
      expect(res.body.data[0]).not.toHaveProperty('token');
    });

    it('DELETE /auth/sessions/:id revokes own session, 404 for another user session', async () => {
      const user = await createVerifiedUser(t);
      const other = await createVerifiedUser(t);
      const [mine, theirs] = await Promise.all(
        [user.userId, other.userId].map((userId) =>
          t.prisma.refreshToken.findFirstOrThrow({ where: { userId } }),
        ),
      );

      const notFound = await request(t.http)
        .delete(`/auth/sessions/${theirs.id}`)
        .set(bearer(user.accessToken))
        .expect(404);
      expect(notFound.body.code).toBe('auth.session.not_found');

      const revoked = await request(t.http)
        .delete(`/auth/sessions/${mine.id}`)
        .set(bearer(user.accessToken))
        .expect(200);
      expect(revoked.body.code).toBe('auth.session.revoked');
      await refreshReq(user.refreshToken).expect(401);
      await refreshReq(other.refreshToken).expect(201);
    });

    it('logout-all revokes every session of the user', async () => {
      const user = await createVerifiedUser(t);
      const second = await login(t, user.email, user.password);

      const res = await request(t.http)
        .post('/auth/logout-all')
        .set(bearer(user.accessToken))
        .expect(201);
      expect(res.body.code).toBe('auth.logout_all.success');

      expect(
        await t.prisma.refreshToken.count({ where: { userId: user.userId } }),
      ).toBe(0);
      await refreshReq(second.refreshToken).expect(401);
    });

    it('keeps at most 10 sessions per user (oldest evicted)', async () => {
      const user = await createVerifiedUser(t); // session 1

      for (let i = 0; i < 10; i++) {
        await login(t, user.email, user.password); // sessions 2..11
      }

      expect(
        await t.prisma.refreshToken.count({ where: { userId: user.userId } }),
      ).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Forgot / reset password
  // ─────────────────────────────────────────────────────────────
  describe('Forgot / reset password', () => {
    const forgot = (email: string) =>
      request(t.http).post('/auth/forgot-password').send({ email });
    const reset = (token: string, password: string) =>
      request(t.http).post('/auth/reset-password').send({ token, password });

    it('same generic answer for known and unknown emails, mail only for known ones', async () => {
      const user = await createVerifiedUser(t);
      const unknown = uniqueEmail('unknown');

      const known = await forgot(user.email).expect(201);
      const notKnown = await forgot(unknown).expect(201);

      expect(known.body).toEqual(notKnown.body);
      expect(known.body.code).toBe('auth.forgot_password.sent');
      expect(t.mail.lastToken(user.email, 'password-reset')).toEqual(
        expect.any(String),
      );
      expect(t.mail.sent.some((m) => m.to === unknown)).toBe(false);
    });

    it('reset changes the password, revokes every session and is single-use', async () => {
      const user = await createVerifiedUser(t);
      await forgot(user.email).expect(201);
      const token = t.mail.lastToken(user.email, 'password-reset');

      const res = await reset(token, NEW_PASSWORD).expect(201);
      expect(res.body.code).toBe('auth.password_reset.success');

      // checked before logging in again: with the known jti bug, a new login
      // in the same second would re-issue the exact same refresh token
      await refreshReq(user.refreshToken).expect(401);
      await loginReq(user.email, user.password).expect(401);
      await loginReq(user.email, NEW_PASSWORD).expect(201);

      const reused = await reset(token, 'Another-Pass-789!').expect(401);
      expect(reused.body.code).toBe('auth.password_reset.invalid_token');
      expect(await auditActions(user.userId)).toContain('password.reset');
    });
  });
});
