import request from 'supertest';
import { Permissions } from '../../src/core/auth/permissions.constants.js';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import { bearer, loginAsAdmin, type AuthTokens } from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';
import { UNKNOWN_ID } from '../setup/test-id.js';
import { createUserWithPermissions } from '../setup/permissions.helper.js';

let roleCounter = 0;
/** Unique role name matching ^[A-Z][A-Z0-9_]*$ */
const uniqueRoleName = () => `TEST_${Date.now()}_${++roleCounter}`;

describe('Admin roles (e2e)', () => {
  let t: TestApp;
  let admin: AuthTokens;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    admin = await loginAsAdmin(t);
  });

  afterAll(() => t.app.close());

  const auditLogs = (roleId: string, action: string) =>
    t.prisma.auditLog.findMany({
      where: { targetType: 'role', targetId: roleId, action },
    });

  const permissionId = async (name: string) =>
    (await t.prisma.permission.findUniqueOrThrow({ where: { name } })).id;

  /** Creates a role through the API, optionally with permissions. */
  async function createRole(permissions: string[] = []) {
    const name = uniqueRoleName();
    const res = await request(t.http)
      .post('/admin/roles')
      .set(bearer(admin.accessToken))
      .send({ name })
      .expect(201);
    if (permissions.length > 0) {
      await request(t.http)
        .post(`/admin/roles/${res.body.id}/permissions`)
        .set(bearer(admin.accessToken))
        .send({ permissions })
        .expect(200);
    }
    return { id: res.body.id as string, name };
  }

  /** The only role of a user created by createUserWithPermissions. */
  const onlyRoleId = async (userId: string) =>
    (await t.prisma.userRole.findFirstOrThrow({ where: { userId } })).roleId;

  // ─────────────────────────────────────────────────────────────
  // GET /admin/roles
  // ─────────────────────────────────────────────────────────────
  describe('GET /admin/roles', () => {
    it('200 returns a paginated list with flattened permissions', async () => {
      const role = await createRole([Permissions.PROFILE_READ]);

      const res = await request(t.http)
        .get('/admin/roles')
        .set(bearer(admin.accessToken))
        .query({ search: role.name })
        .expect(200);

      expect(res.body.data).toEqual([
        expect.objectContaining({
          id: role.id,
          name: role.name,
          permissions: [
            { id: expect.any(String), name: Permissions.PROFILE_READ },
          ],
        }),
      ]);
      expect(res.body.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: role.name,
      });
    });

    it('lists the seeded roles', async () => {
      const res = await request(t.http)
        .get('/admin/roles')
        .set(bearer(admin.accessToken))
        .query({ limit: 100 })
        .expect(200);

      const names = res.body.data.map((r: { name: string }) => r.name);
      expect(names).toEqual(expect.arrayContaining(['USER', 'ADMIN']));
    });

    it('400 validation.failed for an unknown sortBy', async () => {
      const res = await request(t.http)
        .get('/admin/roles')
        .set(bearer(admin.accessToken))
        .query({ sortBy: 'password' })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /admin/roles/:id
  // ─────────────────────────────────────────────────────────────
  describe('GET /admin/roles/:id', () => {
    it('200 returns the role with its flattened permissions', async () => {
      const role = await createRole([
        Permissions.REALM_PROFILE,
        Permissions.PROFILE_READ,
      ]);

      const res = await request(t.http)
        .get(`/admin/roles/${role.id}`)
        .set(bearer(admin.accessToken))
        .expect(200);

      expect(res.body).toMatchObject({ id: role.id, name: role.name });
      expect(res.body.permissions.map((p: { name: string }) => p.name)).toEqual(
        expect.arrayContaining([
          Permissions.REALM_PROFILE,
          Permissions.PROFILE_READ,
        ]),
      );
      expect(res.body.permissions).toHaveLength(2);
    });

    it('404 admin.role.not_found for an unknown id', async () => {
      const res = await request(t.http)
        .get(`/admin/roles/${UNKNOWN_ID}`)
        .set(bearer(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.role.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /admin/roles
  // ─────────────────────────────────────────────────────────────
  describe('POST /admin/roles', () => {
    it('201 creates the role with a trimmed, upper-cased name and audits it', async () => {
      const name = uniqueRoleName();

      const res = await request(t.http)
        .post('/admin/roles')
        .set(bearer(admin.accessToken))
        .send({ name: `  ${name.toLowerCase()}  ` })
        .expect(201);

      expect(res.body).toMatchObject({ id: expect.any(String), name });

      const [log] = await auditLogs(res.body.id, 'role.create');
      expect(log).toMatchObject({ actorId: admin.userId, metadata: { name } });
    });

    it('400 admin.role.already_exists for a duplicate name', async () => {
      const role = await createRole();

      const res = await request(t.http)
        .post('/admin/roles')
        .set(bearer(admin.accessToken))
        .send({ name: role.name })
        .expect(400);
      expect(res.body.code).toBe('admin.role.already_exists');
      expect(res.body.params).toEqual({ name: role.name });
    });

    it.each([
      ['empty', ''],
      ['starting with a digit', '1ROLE'],
      ['with a dash', 'MY-ROLE'],
      ['longer than 50 characters', 'A'.repeat(51)],
    ])('400 validation.failed for a name %s', async (_label, name) => {
      const res = await request(t.http)
        .post('/admin/roles')
        .set(bearer(admin.accessToken))
        .send({ name })
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /admin/roles/:id
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /admin/roles/:id', () => {
    it('200 deletes the role, cascades its permission links and audits it', async () => {
      const role = await createRole([Permissions.PROFILE_READ]);

      const res = await request(t.http)
        .delete(`/admin/roles/${role.id}`)
        .set(bearer(admin.accessToken))
        .expect(200);
      expect(res.body).toMatchObject({
        code: 'admin.role.deleted',
        params: { name: role.name },
      });

      expect(await t.prisma.role.count({ where: { id: role.id } })).toBe(0);
      expect(
        await t.prisma.rolePermission.count({ where: { roleId: role.id } }),
      ).toBe(0);

      const [log] = await auditLogs(role.id, 'role.delete');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: { name: role.name },
      });
    });

    it('400 admin.role.has_users while the role is assigned', async () => {
      const user = await createUserWithPermissions(t, [
        Permissions.REALM_PROFILE,
      ]);
      const roleId = await onlyRoleId(user.userId);

      const res = await request(t.http)
        .delete(`/admin/roles/${roleId}`)
        .set(bearer(admin.accessToken))
        .expect(400);
      expect(res.body.code).toBe('admin.role.has_users');
      expect(res.body.params).toEqual({ count: 1 });
      expect(await t.prisma.role.count({ where: { id: roleId } })).toBe(1);
    });

    it('404 admin.role.not_found for an unknown id', async () => {
      const res = await request(t.http)
        .delete(`/admin/roles/${UNKNOWN_ID}`)
        .set(bearer(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.role.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // POST /admin/roles/:id/permissions
  // ─────────────────────────────────────────────────────────────
  describe('POST /admin/roles/:id/permissions', () => {
    it('200 adds the permissions and returns the updated role, audited', async () => {
      const role = await createRole();

      const res = await request(t.http)
        .post(`/admin/roles/${role.id}/permissions`)
        .set(bearer(admin.accessToken))
        .send({
          permissions: [Permissions.REALM_PROFILE, Permissions.PROFILE_READ],
        })
        .expect(200);

      expect(res.body.id).toBe(role.id);
      expect(res.body.permissions).toHaveLength(2);

      const [log] = await auditLogs(role.id, 'role.permission.assign');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: {
          roleName: role.name,
          permissions: [Permissions.REALM_PROFILE, Permissions.PROFILE_READ],
        },
      });
    });

    it('is idempotent: adding an already assigned permission creates no duplicate', async () => {
      const role = await createRole([Permissions.PROFILE_READ]);

      const res = await request(t.http)
        .post(`/admin/roles/${role.id}/permissions`)
        .set(bearer(admin.accessToken))
        .send({ permissions: [Permissions.PROFILE_READ] })
        .expect(200);

      expect(res.body.permissions).toHaveLength(1);
    });

    it('400 admin.permission.unknown lists only the unknown names and adds nothing', async () => {
      const role = await createRole();

      const res = await request(t.http)
        .post(`/admin/roles/${role.id}/permissions`)
        .set(bearer(admin.accessToken))
        .send({ permissions: [Permissions.PROFILE_READ, 'nope:nope'] })
        .expect(400);

      expect(res.body.code).toBe('admin.permission.unknown');
      expect(res.body.params).toEqual({ permissions: ['nope:nope'] });
      expect(
        await t.prisma.rolePermission.count({ where: { roleId: role.id } }),
      ).toBe(0);
    });

    it.each([
      ['an empty array', { permissions: [] }],
      ['a string instead of an array', { permissions: 'profile:read' }],
      ['a missing field', {}],
    ])('400 validation.failed for %s', async (_label, body) => {
      const role = await createRole();

      const res = await request(t.http)
        .post(`/admin/roles/${role.id}/permissions`)
        .set(bearer(admin.accessToken))
        .send(body)
        .expect(400);
      expect(res.body.code).toBe('validation.failed');
    });

    it('404 admin.role.not_found for an unknown role', async () => {
      const res = await request(t.http)
        .post(`/admin/roles/${UNKNOWN_ID}/permissions`)
        .set(bearer(admin.accessToken))
        .send({ permissions: [Permissions.PROFILE_READ] })
        .expect(404);
      expect(res.body.code).toBe('admin.role.not_found');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DELETE /admin/roles/:id/permissions/:permId
  // ─────────────────────────────────────────────────────────────
  describe('DELETE /admin/roles/:id/permissions/:permId', () => {
    it('200 removes the permission from the role and audits it', async () => {
      const role = await createRole([
        Permissions.REALM_PROFILE,
        Permissions.PROFILE_READ,
      ]);
      const permId = await permissionId(Permissions.PROFILE_READ);

      const res = await request(t.http)
        .delete(`/admin/roles/${role.id}/permissions/${permId}`)
        .set(bearer(admin.accessToken))
        .expect(200);
      expect(res.body.code).toBe('admin.role.permission.removed');

      const links = await t.prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      expect(links.map((l) => l.permission.name)).toEqual([
        Permissions.REALM_PROFILE,
      ]);

      const [log] = await auditLogs(role.id, 'role.permission.revoke');
      expect(log).toMatchObject({
        actorId: admin.userId,
        metadata: {
          roleName: role.name,
          permissionName: Permissions.PROFILE_READ,
        },
      });
    });

    it('404 admin.role.permission.not_assigned when the role does not hold it', async () => {
      const role = await createRole();
      const permId = await permissionId(Permissions.PROFILE_READ);

      const res = await request(t.http)
        .delete(`/admin/roles/${role.id}/permissions/${permId}`)
        .set(bearer(admin.accessToken))
        .expect(404);
      expect(res.body.code).toBe('admin.role.permission.not_assigned');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Permission changes apply immediately to logged-in users
  // (the JWT strategy caches users, the service must invalidate the cache)
  // ─────────────────────────────────────────────────────────────
  describe('cache invalidation on role permission changes', () => {
    it('removing a permission revokes access immediately, with the same access token', async () => {
      const user = await createUserWithPermissions(t, [
        Permissions.REALM_PROFILE,
        Permissions.PROFILE_READ,
      ]);
      const roleId = await onlyRoleId(user.userId);
      // warm the user cache with the current permissions
      await request(t.http)
        .get(`/profiles/${user.userId}`)
        .set(bearer(user.accessToken))
        .expect(200);

      const permId = await permissionId(Permissions.PROFILE_READ);
      await request(t.http)
        .delete(`/admin/roles/${roleId}/permissions/${permId}`)
        .set(bearer(admin.accessToken))
        .expect(200);

      await request(t.http)
        .get(`/profiles/${user.userId}`)
        .set(bearer(user.accessToken))
        .expect(403);
    });

    it('adding a permission grants access immediately, with the same access token', async () => {
      const user = await createUserWithPermissions(t, [
        Permissions.REALM_PROFILE,
      ]);
      const roleId = await onlyRoleId(user.userId);
      // warm the user cache: the permission is missing
      await request(t.http)
        .get(`/profiles/${user.userId}`)
        .set(bearer(user.accessToken))
        .expect(403);

      await request(t.http)
        .post(`/admin/roles/${roleId}/permissions`)
        .set(bearer(admin.accessToken))
        .send({ permissions: [Permissions.PROFILE_READ] })
        .expect(200);

      await request(t.http)
        .get(`/profiles/${user.userId}`)
        .set(bearer(user.accessToken))
        .expect(200);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /admin/permissions
  // ─────────────────────────────────────────────────────────────
  describe('GET /admin/permissions', () => {
    it('200 returns a paginated list of the seeded permissions', async () => {
      const res = await request(t.http)
        .get('/admin/permissions')
        .set(bearer(admin.accessToken))
        .query({ limit: 100 })
        .expect(200);

      const names = res.body.data.map((p: { name: string }) => p.name);
      expect(names).toEqual(expect.arrayContaining(Object.values(Permissions)));
      expect(res.body.meta.total).toBe(Object.values(Permissions).length);
    });

    it('search filters by name (case-insensitive)', async () => {
      const res = await request(t.http)
        .get('/admin/permissions')
        .set(bearer(admin.accessToken))
        .query({ search: 'ADMIN:USER', limit: 100 })
        .expect(200);

      const names = res.body.data.map((p: { name: string }) => p.name).sort();
      expect(names).toEqual(
        [
          Permissions.ADMIN_USER_READ,
          Permissions.ADMIN_USER_ASSIGN_ROLE,
          Permissions.ADMIN_USER_DELETE,
          Permissions.ADMIN_USER_SESSION_READ,
          Permissions.ADMIN_USER_SESSION_REVOKE,
        ].sort(),
      );
      expect(res.body.meta.search).toBe('ADMIN:USER');
    });
  });
});
