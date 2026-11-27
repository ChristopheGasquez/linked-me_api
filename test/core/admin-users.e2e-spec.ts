import request from 'supertest';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import {
  authCookie,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  login,
  loginAsAdmin,
  uniqueEmail,
  type AuthTokens,
  refreshCookie,
} from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';
import { UNKNOWN_ID } from '../setup/test-id.js';

describe('Admin users (e2e)', () => {
  let t: TestApp;
  let admin: AuthTokens;
  let userRoleId: string;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    admin = await loginAsAdmin(t);
    userRoleId = (
      await t.prisma.role.findUniqueOrThrow({ where: { name: 'USER' } })
    ).id;
  });

  afterAll(() => t.app.close());

  const auditLogs = (userId: string, action: string) =>
    t.prisma.auditLog.findMany({
      where: { targetType: 'user', targetId: userId, action },
    });

  /** Registers a user without verifying the email. */
  async function createUnverifiedUser(email = uniqueEmail('unverified')) {
    const res = await request(t.http)
      .post('/auth/register')
      .send({ email, password: DEFAULT_PASSWORD, name: 'Unverified' })
      .expect(201);
    return { email, userId: res.body.id as string };
  }

  const removeRole = (userId: string, roleId: string) =>
    request(t.http)
      .delete(`/admin/users/${userId}/roles/${roleId}`)
      .set(authCookie(admin.accessToken));

  // ─────────────────────────────────────────────────────────────
  // GET /admin/users
  // ─────────────────────────────────────────────────────────────
  describe('GET /admin/users', () => {
    it('200 returns a paginated list, without passwords, with flattened roles', async () => {
      const user = await createVerifiedUser(t, { name: 'Listed' });

      const res = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ search: user.email })
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      const [listed] = res.body.data;
      expect(listed).toMatchObject({
        id: user.userId,
        email: user.email,
        name: 'Listed',
        isEmailChecked: true,
        roles: [expect.objectContaining({ id: userRoleId, name: 'USER' })],
      });
      expect(listed).not.toHaveProperty('password');
      expect(res.body.meta).toMatchObject({
        page: 1,
        total: 1,
        search: user.email,
      });
    });

    it('never exposes passwords, on any page', async () => {
      await createVerifiedUser(t);

      const res = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ limit: 100 })
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(1);
      for (const u of res.body.data) {
        expect(u).not.toHaveProperty('password');
      }
    });

    it('filters by role (trimmed, upper-cased) and returns the filter in meta', async () => {
      const res = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ role: ' admin ' })
        .expect(200);

      expect(res.body.data.map((u: { email: string }) => u.email)).toEqual([
        process.env.ADMIN_EMAIL,
      ]);
      expect(res.body.meta.filters).toEqual({ role: 'ADMIN' });
    });

    it('filters by isEmailChecked', async () => {
      const verified = await createVerifiedUser(t);
      const unverified = await createUnverifiedUser();

      const unchecked = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ isEmailChecked: 'false', limit: 100 })
        .expect(200);
      const uncheckedIds = unchecked.body.data.map((u: { id: string }) => u.id);
      expect(uncheckedIds).toContain(unverified.userId);
      expect(uncheckedIds).not.toContain(verified.userId);
      expect(unchecked.body.meta.filters).toEqual({ isEmailChecked: false });

      const checked = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ isEmailChecked: 'true', limit: 100 })
        .expect(200);
      const checkedIds = checked.body.data.map((u: { id: string }) => u.id);
      expect(checkedIds).toContain(verified.userId);
      expect(checkedIds).not.toContain(unverified.userId);
    });

    it('search matches the name too (case-insensitive)', async () => {
      const name = `Searchable ${Date.now()}`;
      const user = await createVerifiedUser(t, { name });

      const res = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ search: name.toUpperCase() })
        .expect(200);

      expect(res.body.data.map((u: { id: string }) => u.id)).toEqual([
        user.userId,
      ]);
    });

    it('400 validation.failed for a non-boolean isEmailChecked', async () => {
      const res = await request(t.http)
        .get('/admin/users')
        .set(authCookie(admin.accessToken))
        .query({ isEmailChecked: 'abc' })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /admin/users/:id
  // ─────────────────────────────────────────────────────────────
  describe('GET /admin/users/:id', () => {
    it('200 returns the user without password, with flattened roles', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .get(`/admin/users/${user.userId}`)
        .set(authCookie(admin.accessToken))
        .expect(200);

      expect(res.body).toMatchObject({
        id: user.userId,
        email: user.email,
        roles: [expect.objectContaining({ name: 'USER' })],
      });
      expect(res.body).not.toHaveProperty('password');
    });

    it('404 admin.user.not_found for an unknown id', async () => {
      const res = await request(t.http)
        .get(`/admin/users/${UNKNOWN_ID}`)
        .set(authCookie(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.user.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /admin/users/:id/roles
  // ─────────────────────────────────────────────────────────────
  describe('POST /admin/users/:id/roles', () => {
    it('201 assigns the role (name upper-cased) and audits it', async () => {
      const user = await createVerifiedUser(t);
      await removeRole(user.userId, userRoleId).expect(200);

      const res = await request(t.http)
        .post(`/admin/users/${user.userId}/roles`)
        .set(authCookie(admin.accessToken))
        .send({ role: ' user ' })
        .expect(201);
      expect(res.body).toMatchObject({
        code: 'admin.user.role.assigned',
        params: { roleName: 'USER', userId: user.userId },
      });

      expect(
        await t.prisma.userRole.count({
          where: { userId: user.userId, roleId: userRoleId },
        }),
      ).toBe(1);

      const [log] = await auditLogs(user.userId, 'user.role.assign');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { roleName: 'USER' },
      });
    });

    it('400 admin.user.role.already_assigned when the user already has it', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .post(`/admin/users/${user.userId}/roles`)
        .set(authCookie(admin.accessToken))
        .send({ role: 'USER' })
        .expect(400);
      expect(res.body.code).toBe('admin.user.role.already_assigned');
      expect(res.body.params).toEqual({ roleName: 'USER' });
    });

    it('404 admin.user.not_found for an unknown user', async () => {
      const res = await request(t.http)
        .post(`/admin/users/${UNKNOWN_ID}/roles`)
        .set(authCookie(admin.accessToken))
        .send({ role: 'USER' })
        .expect(404);
      expect(res.body.code).toBe('admin.user.not_found');
    });

    it('404 admin.role.not_found for an unknown role', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .post(`/admin/users/${user.userId}/roles`)
        .set(authCookie(admin.accessToken))
        .send({ role: 'NOPE' })
        .expect(404);
      expect(res.body.code).toBe('admin.role.not_found');
      expect(res.body.params).toEqual({ roleName: 'NOPE' });
    });

    it('400 validation.failed for an empty role', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .post(`/admin/users/${user.userId}/roles`)
        .set(authCookie(admin.accessToken))
        .send({ role: '' })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /admin/users/:id/roles/:roleId
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /admin/users/:id/roles/:roleId', () => {
    it('200 removes the role and audits it', async () => {
      const user = await createVerifiedUser(t);

      const res = await removeRole(user.userId, userRoleId).expect(200);
      expect(res.body.code).toBe('admin.user.role.removed');

      expect(
        await t.prisma.userRole.count({ where: { userId: user.userId } }),
      ).toBe(0);

      const [log] = await auditLogs(user.userId, 'user.role.revoke');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { roleName: 'USER' },
      });
    });

    it('404 admin.user.role.not_assigned when the user does not have the role', async () => {
      const user = await createVerifiedUser(t);
      await removeRole(user.userId, userRoleId).expect(200);

      const res = await removeRole(user.userId, userRoleId).expect(404);
      expect(res.body.code).toBe('admin.user.role.not_assigned');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Role changes apply immediately to the logged-in user
  // ─────────────────────────────────────────────────────────────
  it('removing then re-assigning a role applies immediately, with the same access token', async () => {
    const user = await createVerifiedUser(t);
    // warm the user cache: the USER role grants realm:profile + profile:read
    await request(t.http)
      .get(`/profiles/${user.userId}`)
      .set(authCookie(user.accessToken))
      .expect(200);

    await removeRole(user.userId, userRoleId).expect(200);
    await request(t.http)
      .get(`/profiles/${user.userId}`)
      .set(authCookie(user.accessToken))
      .expect(403);

    await request(t.http)
      .post(`/admin/users/${user.userId}/roles`)
      .set(authCookie(admin.accessToken))
      .send({ role: 'USER' })
      .expect(201);
    await request(t.http)
      .get(`/profiles/${user.userId}`)
      .set(authCookie(user.accessToken))
      .expect(200);
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /admin/users/:id
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /admin/users/:id', () => {
    it('400 admin.user.has_roles while the user still has roles', async () => {
      const user = await createVerifiedUser(t);

      const res = await request(t.http)
        .delete(`/admin/users/${user.userId}`)
        .set(authCookie(admin.accessToken))
        .expect(400);
      expect(res.body.code).toBe('admin.user.has_roles');
      expect(await t.prisma.user.count({ where: { id: user.userId } })).toBe(1);
    });

    it('200 deletes a user without roles: sessions cascaded, audited, access token rejected at once', async () => {
      const user = await createVerifiedUser(t, { name: 'Doomed' });
      // warm the user cache used by the JWT strategy
      await request(t.http)
        .get('/auth/me')
        .set(authCookie(user.accessToken))
        .expect(200);
      await removeRole(user.userId, userRoleId).expect(200);

      const res = await request(t.http)
        .delete(`/admin/users/${user.userId}`)
        .set(authCookie(admin.accessToken))
        .expect(200);
      expect(res.body).toMatchObject({
        code: 'admin.user.deleted',
        params: { userId: user.userId },
      });

      expect(await t.prisma.user.count({ where: { id: user.userId } })).toBe(0);
      expect(
        await t.prisma.refreshToken.count({ where: { userId: user.userId } }),
      ).toBe(0);

      const [log] = await auditLogs(user.userId, 'user.delete');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { email: user.email, name: 'Doomed' },
      });

      await request(t.http)
        .get('/auth/me')
        .set(authCookie(user.accessToken))
        .expect(401);
      await request(t.http)
        .post('/auth/refresh')
        .set(refreshCookie(user.refreshToken))
        .expect(401);
    });

    it('404 admin.user.not_found for an unknown id', async () => {
      const res = await request(t.http)
        .delete(`/admin/users/${UNKNOWN_ID}`)
        .set(authCookie(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.user.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Sessions of a user
  // ─────────────────────────────────────────────────────────────
  /** A verified user with two sessions; the first one is expired when asked. */
  async function userWithTwoSessions(opts: { expireFirst?: boolean } = {}) {
    const user = await createVerifiedUser(t);
    const second = await login(t, user.email, user.password);
    const sessions = await t.prisma.refreshToken.findMany({
      where: { userId: user.userId },
      orderBy: { id: 'asc' },
    });
    if (opts.expireFirst) {
      await t.prisma.refreshToken.update({
        where: { id: sessions[0].id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
    }
    return { user, second, sessionIds: sessions.map((s) => s.id) };
  }

  const refresh = (refreshToken: string) =>
    request(t.http).post('/auth/refresh').set(refreshCookie(refreshToken));

  describe('GET /admin/users/:id/sessions', () => {
    it("200 lists the user's active sessions only, without the token hash", async () => {
      const { user, sessionIds } = await userWithTwoSessions({
        expireFirst: true,
      });

      const res = await request(t.http)
        .get(`/admin/users/${user.userId}/sessions`)
        .set(authCookie(admin.accessToken))
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: sessionIds[1],
        userId: user.userId,
      });
      expect(res.body.data[0]).not.toHaveProperty('token');
      expect(res.body.meta).toMatchObject({ page: 1, total: 1 });
    });

    it('404 admin.user.not_found for an unknown user', async () => {
      const res = await request(t.http)
        .get(`/admin/users/${UNKNOWN_ID}/sessions`)
        .set(authCookie(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.user.not_found');
    });

    it('400 validation.failed for an unknown sortBy', async () => {
      const res = await request(t.http)
        .get(`/admin/users/${admin.userId}/sessions`)
        .set(authCookie(admin.accessToken))
        .query({ sortBy: 'token' })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  describe('DELETE /admin/users/:id/sessions/:sessionId', () => {
    it('200 revokes only that session and audits it', async () => {
      const { user, second, sessionIds } = await userWithTwoSessions();

      const res = await request(t.http)
        .delete(`/admin/users/${user.userId}/sessions/${sessionIds[0]}`)
        .set(authCookie(admin.accessToken))
        .expect(200);
      expect(res.body).toMatchObject({
        code: 'admin.user.session.revoked',
        params: { userId: user.userId, sessionId: sessionIds[0] },
      });

      await refresh(user.refreshToken).expect(401);
      await refresh(second.refreshToken).expect(201);

      const [log] = await auditLogs(user.userId, 'user.session.revoke');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { sessionId: sessionIds[0] },
      });
    });

    it('404 admin.user.session.not_found when the session belongs to another user', async () => {
      const owner = await createVerifiedUser(t);
      const other = await createVerifiedUser(t);
      const session = await t.prisma.refreshToken.findFirstOrThrow({
        where: { userId: owner.userId },
      });

      const res = await request(t.http)
        .delete(`/admin/users/${other.userId}/sessions/${session.id}`)
        .set(authCookie(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.user.session.not_found');
      await refresh(owner.refreshToken).expect(201);
    });
  });

  describe('DELETE /admin/users/:id/sessions', () => {
    it('200 revokes all sessions, counts only active ones, audits it', async () => {
      const { user, second } = await userWithTwoSessions({
        expireFirst: true,
      });

      const res = await request(t.http)
        .delete(`/admin/users/${user.userId}/sessions`)
        .set(authCookie(admin.accessToken))
        .expect(200);
      expect(res.body).toMatchObject({
        code: 'admin.user.sessions.revoked',
        params: { userId: user.userId, count: 1 },
      });

      expect(
        await t.prisma.refreshToken.count({ where: { userId: user.userId } }),
      ).toBe(0);
      await refresh(second.refreshToken).expect(401);

      const [log] = await auditLogs(user.userId, 'user.session.revoke_all');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { count: 1 },
      });
    });

    it('404 admin.user.not_found for an unknown user', async () => {
      const res = await request(t.http)
        .delete(`/admin/users/${UNKNOWN_ID}/sessions`)
        .set(authCookie(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.user.not_found');
    });
  });
});
