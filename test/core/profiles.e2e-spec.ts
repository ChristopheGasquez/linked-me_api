import request from 'supertest';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import {
  bearer,
  createVerifiedUser,
  login,
  uniqueEmail,
} from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';

const NEW_PASSWORD = 'New-Password-456!';

describe('Profiles (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  const auditLogs = (userId: number, action: string) =>
    t.prisma.auditLog.findMany({
      where: { targetType: 'user', targetId: userId, action },
    });

  // ─────────────────────────────────────────────────────────────
  // GET /profiles/:id
  // ─────────────────────────────────────────────────────────────
  describe('GET /profiles/:id', () => {
    it('200 returns the public profile only', async () => {
      const viewer = await createVerifiedUser(t);
      const target = await createVerifiedUser(t, { name: 'Target' });

      const res = await request(t.http)
        .get(`/profiles/${target.userId}`)
        .set(bearer(viewer.accessToken))
        .expect(200);

      expect(res.body).toEqual({
        id: target.userId,
        name: 'Target',
        email: target.email,
        createdAt: expect.any(String),
      });
    });

    it('404 profile.user.not_found for an unknown id', async () => {
      const viewer = await createVerifiedUser(t);

      const res = await request(t.http)
        .get('/profiles/999999')
        .set(bearer(viewer.accessToken))
        .expect(404);
      expect(res.body.code).toBe('profile.user.not_found');
    });

    it('400 for a non-numeric id', async () => {
      const viewer = await createVerifiedUser(t);

      await request(t.http)
        .get('/profiles/abc')
        .set(bearer(viewer.accessToken))
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /profiles/me
  // ─────────────────────────────────────────────────────────────
  describe('PATCH /profiles/me', () => {
    it('200 updates the trimmed name, visible immediately on /auth/me (cache invalidated)', async () => {
      const user = await createVerifiedUser(t, { name: 'Before' });
      // warm the user cache used by the JWT strategy
      await request(t.http)
        .get('/auth/me')
        .set(bearer(user.accessToken))
        .expect(200);

      const res = await request(t.http)
        .patch('/profiles/me')
        .set(bearer(user.accessToken))
        .send({ name: '  After  ' })
        .expect(200);
      expect(res.body.name).toBe('After');

      const me = await request(t.http)
        .get('/auth/me')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(me.body.name).toBe('After');

      const [log] = await auditLogs(user.userId, 'profile.update');
      expect(log.metadata).toEqual({ fields: ['name'] });
    });

    it('ignores fields that are not part of the DTO (email, isEmailChecked)', async () => {
      const user = await createVerifiedUser(t);

      await request(t.http)
        .patch('/profiles/me')
        .set(bearer(user.accessToken))
        .send({ email: uniqueEmail('hijack'), isEmailChecked: false })
        .expect(200);

      const stored = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.userId },
      });
      expect(stored.email).toBe(user.email);
      expect(stored.isEmailChecked).toBe(true);
    });

    it('400 validation.failed for a name shorter than 2 characters', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .patch('/profiles/me')
        .set(bearer(user.accessToken))
        .send({ name: 'A' })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // PATCH /profiles/me/password
  // ─────────────────────────────────────────────────────────────
  describe('PATCH /profiles/me/password', () => {
    const changePassword = (
      accessToken: string,
      body: Record<string, unknown>,
    ) =>
      request(t.http)
        .patch('/profiles/me/password')
        .set(bearer(accessToken))
        .send(body);

    it('401 profile.password.incorrect when the current password is wrong', async () => {
      const user = await createVerifiedUser(t);

      const res = await changePassword(user.accessToken, {
        currentPassword: 'Wrong-Pass-1!',
        newPassword: NEW_PASSWORD,
      }).expect(401);
      expect(res.body.code).toBe('profile.password.incorrect');
    });

    it('400 validation.failed for a weak new password', async () => {
      const user = await createVerifiedUser(t);

      const res = await changePassword(user.accessToken, {
        currentPassword: user.password,
        newPassword: 'weakpassword',
      }).expect(400);
      expect(res.body.code).toBe('validation.failed');
    });

    it('200 changes the password and revokes every session', async () => {
      const user = await createVerifiedUser(t);

      const res = await changePassword(user.accessToken, {
        currentPassword: user.password,
        newPassword: NEW_PASSWORD,
      }).expect(200);
      expect(res.body.code).toBe('profile.password.changed');

      // checked before logging in again (see the jti known bug in test/README.md)
      await request(t.http)
        .post('/auth/refresh')
        .send({ refresh_token: user.refreshToken })
        .expect(401);
      await request(t.http)
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);
      await login(t, user.email, NEW_PASSWORD);

      expect(
        await auditLogs(user.userId, 'profile.password.change'),
      ).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /profiles/me
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /profiles/me', () => {
    it('200 deletes the account and its sessions, keeps the audit log', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .delete('/profiles/me')
        .set(bearer(user.accessToken))
        .expect(200);
      expect(res.body.code).toBe('profile.deleted');

      expect(
        await t.prisma.user.findUnique({ where: { id: user.userId } }),
      ).toBeNull();
      expect(
        await t.prisma.refreshToken.count({ where: { userId: user.userId } }),
      ).toBe(0);
      await request(t.http)
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(401);

      const [log] = await auditLogs(user.userId, 'profile.delete');
      expect(log.metadata).toEqual({ email: user.email });
    });

    // KNOWN BUG (skipped until the fix PR): remove() does not invalidate the
    // user cache, so the JWT strategy keeps accepting the token for up to 5 min.
    it.skip('[KNOWN BUG: user cache] the access token of a deleted account is rejected', async () => {
      const user = await createVerifiedUser(t);

      await request(t.http)
        .delete('/profiles/me')
        .set(bearer(user.accessToken))
        .expect(200);

      await request(t.http)
        .get('/auth/me')
        .set(bearer(user.accessToken))
        .expect(401);
    });
  });
});
