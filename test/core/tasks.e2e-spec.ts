import request from 'supertest';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import {
  bearer,
  createVerifiedUser,
  DEFAULT_PASSWORD,
  loginAsAdmin,
  uniqueEmail,
  type AuthTokens,
} from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(Date.now() - ms);
const inFuture = (ms: number) => new Date(Date.now() + ms);

/** Prefix of the permissions created by this suite (not in the constants). */
const ORPHAN_PREFIX = 'e2e-orphan:';

describe('Tasks (e2e)', () => {
  let t: TestApp;
  let admin: AuthTokens;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    admin = await loginAsAdmin(t);
  });

  afterAll(async () => {
    // safety net if a test failed before the task removed them
    await t.prisma.permission.deleteMany({
      where: { name: { startsWith: ORPHAN_PREFIX } },
    });
    await t.app.close();
  });

  const runTask = (name: string, body: Record<string, unknown> = {}) =>
    request(t.http)
      .post(`/tasks/${name}`)
      .set(bearer(admin.accessToken))
      .send(body);

  const lastTaskLog = (action: string) =>
    t.prisma.auditLog.findFirstOrThrow({
      where: { action, targetType: 'task' },
      orderBy: { id: 'desc' },
    });

  const exists = async (userId: number) =>
    (await t.prisma.user.count({ where: { id: userId } })) === 1;

  // ─────────────────────────────────────────────────────────────
  // POST /tasks/cleanup-unverified-users (TTL: UNVERIFIED_USER_TTL_HOURS=24)
  // ─────────────────────────────────────────────────────────────
  describe('POST /tasks/cleanup-unverified-users', () => {
    async function registerUnverified(createdAt: Date) {
      const res = await request(t.http)
        .post('/auth/register')
        .send({
          email: uniqueEmail('unverified'),
          password: DEFAULT_PASSWORD,
          name: 'Unverified',
        })
        .expect(201);
      const id = res.body.id as number;
      await t.prisma.user.update({ where: { id }, data: { createdAt } });
      return id;
    }

    it('200 deletes only unverified accounts older than the TTL, audited', async () => {
      const oldUnverified = await registerUnverified(ago(25 * HOUR));
      const recentUnverified = await registerUnverified(ago(1 * HOUR));
      const oldVerified = await createVerifiedUser(t);
      await t.prisma.user.update({
        where: { id: oldVerified.userId },
        data: { createdAt: ago(25 * HOUR) },
      });

      const res = await runTask('cleanup-unverified-users').expect(200);
      expect(res.body).toMatchObject({
        code: 'task.cleanup.unverified_users.done',
        params: { count: 1 },
      });

      expect(await exists(oldUnverified)).toBe(false);
      expect(await exists(recentUnverified)).toBe(true);
      expect(await exists(oldVerified.userId)).toBe(true);
      // cascade: the verification tokens of the deleted account are gone
      expect(
        await t.prisma.emailVerification.count({
          where: { userId: oldUnverified },
        }),
      ).toBe(0);

      const log = await lastTaskLog('task.cleanup.unverified-users');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { count: 1, ttlHours: 24 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /tasks/cleanup-expired-tokens
  // ─────────────────────────────────────────────────────────────
  describe('POST /tasks/cleanup-expired-tokens', () => {
    it('200 deletes only expired refresh tokens and password resets, audited', async () => {
      // clean slate: only this test's tokens are counted
      await runTask('cleanup-expired-tokens').expect(200);
      const user = await createVerifiedUser(t);
      const userId = user.userId;

      const [expiredRefresh, validRefresh, expiredReset, validReset] =
        await Promise.all([
          t.prisma.refreshToken.create({
            data: { userId, token: 'expired', expiresAt: ago(HOUR) },
          }),
          t.prisma.refreshToken.create({
            data: { userId, token: 'valid', expiresAt: inFuture(DAY) },
          }),
          t.prisma.passwordReset.create({
            data: { userId, token: 'expired', expiresAt: ago(HOUR) },
          }),
          t.prisma.passwordReset.create({
            data: { userId, token: 'valid', expiresAt: inFuture(HOUR) },
          }),
        ]);

      const res = await runTask('cleanup-expired-tokens').expect(200);
      expect(res.body).toMatchObject({
        code: 'task.cleanup.expired_tokens.done',
        params: { count: 2, refreshTokens: 1, passwordResets: 1 },
      });

      const refreshIds = (
        await t.prisma.refreshToken.findMany({ where: { userId } })
      ).map((r) => r.id);
      expect(refreshIds).toContain(validRefresh.id);
      expect(refreshIds).not.toContain(expiredRefresh.id);

      const resetIds = (
        await t.prisma.passwordReset.findMany({ where: { userId } })
      ).map((r) => r.id);
      expect(resetIds).toEqual([validReset.id]);
      expect(resetIds).not.toContain(expiredReset.id);

      // the session opened by the real login is untouched
      await request(t.http)
        .post('/auth/refresh')
        .send({ refresh_token: user.refreshToken })
        .expect(201);

      const log = await lastTaskLog('task.cleanup.expired-tokens');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { refreshTokens: 1, passwordResets: 1 },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /tasks/cleanup-orphaned-permissions
  // ─────────────────────────────────────────────────────────────
  describe('POST /tasks/cleanup-orphaned-permissions', () => {
    it('200 none_found when every permission is declared in the constants', async () => {
      const res = await runTask('cleanup-orphaned-permissions').expect(200);
      expect(res.body).toMatchObject({
        code: 'task.cleanup.orphaned_permissions.none_found',
        params: { count: 0, deleted: [] },
      });
    });

    it('200 deletes orphaned permissions and their role links, keeps the declared ones, audited', async () => {
      const before = await t.prisma.permission.count();
      const orphan = await t.prisma.permission.create({
        data: { name: `${ORPHAN_PREFIX}legacy` },
      });
      const role = await t.prisma.role.create({
        data: {
          name: `TEST_ORPHAN_${Date.now()}`,
          permissions: { create: [{ permissionId: orphan.id }] },
        },
      });

      const res = await runTask('cleanup-orphaned-permissions').expect(200);
      expect(res.body).toMatchObject({
        code: 'task.cleanup.orphaned_permissions.done',
        params: { count: 1, deleted: [orphan.name] },
      });

      expect(
        await t.prisma.permission.count({ where: { id: orphan.id } }),
      ).toBe(0);
      expect(
        await t.prisma.rolePermission.count({ where: { roleId: role.id } }),
      ).toBe(0);
      expect(await t.prisma.permission.count()).toBe(before);

      const log = await lastTaskLog('task.cleanup.orphaned-permissions');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { count: 1, deleted: [orphan.name] },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /tasks/cleanup-audit-logs
  // ─────────────────────────────────────────────────────────────
  describe('POST /tasks/cleanup-audit-logs', () => {
    it('200 deletes only logs older than olderThanDays, then logs its own run', async () => {
      // clean slate: removes logs older than 1 day left by other tests
      await runTask('cleanup-audit-logs', { olderThanDays: 1 }).expect(200);
      const [old, recent] = await Promise.all([
        t.prisma.auditLog.create({
          data: { action: 'e2e.old', createdAt: ago(40 * DAY) },
        }),
        t.prisma.auditLog.create({
          data: { action: 'e2e.recent', createdAt: ago(5 * DAY) },
        }),
      ]);

      const res = await runTask('cleanup-audit-logs', {
        olderThanDays: 30,
      }).expect(200);
      expect(res.body).toMatchObject({
        code: 'task.cleanup.audit_logs.done',
        params: { count: 1, olderThanDays: 30 },
      });

      expect(await t.prisma.auditLog.count({ where: { id: old.id } })).toBe(0);
      expect(await t.prisma.auditLog.count({ where: { id: recent.id } })).toBe(
        1,
      );

      const log = await lastTaskLog('task.cleanup.audit-logs');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { count: 1, olderThanDays: 30 },
      });
    });

    it.each([
      ['missing', {}],
      ['0', { olderThanDays: 0 }],
      ['not an integer', { olderThanDays: 1.5 }],
      ['not a number', { olderThanDays: 'abc' }],
    ])('400 validation.failed when olderThanDays is %s', async (_l, body) => {
      const res = await runTask('cleanup-audit-logs', body).expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });
});
