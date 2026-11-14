import request from 'supertest';
import {
  Permissions as P,
  type Permission,
} from '../../src/core/auth/permissions.constants.js';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import { bearer, createVerifiedUser } from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';
import { createUserWithPermissions } from '../setup/permissions.helper.js';

/**
 * Route security net: every route of the app must be listed in exactly one
 * of the three tables below. Adding a route without listing it fails the
 * "route inventory" test.
 *
 * Path params use 999999 (never an existing id): guards run before pipes and
 * handlers, so 400/404 still prove that access was granted.
 */

type Method = 'get' | 'post' | 'patch' | 'delete';
type Route = { method: Method; path: string };
type ProtectedRoute = Route & {
  permissions: readonly Permission[];
  /** The call deletes the calling user: use a dedicated one. */
  destructive?: boolean;
};

const NO_ID = 999999;

const PROTECTED_ROUTES: ProtectedRoute[] = [
  // Admin — roles
  {
    method: 'get',
    path: '/admin/roles',
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_READ],
  },
  {
    method: 'get',
    path: `/admin/roles/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_READ],
  },
  {
    method: 'post',
    path: '/admin/roles',
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_MANAGE],
  },
  {
    method: 'delete',
    path: `/admin/roles/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_MANAGE],
  },
  {
    method: 'post',
    path: `/admin/roles/${NO_ID}/permissions`,
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_MANAGE],
  },
  {
    method: 'delete',
    path: `/admin/roles/${NO_ID}/permissions/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_ROLE_MANAGE],
  },
  {
    method: 'get',
    path: '/admin/permissions',
    permissions: [P.REALM_ADMIN, P.ADMIN_PERMISSION_READ],
  },
  // Admin — users
  {
    method: 'get',
    path: '/admin/users',
    permissions: [P.REALM_ADMIN, P.ADMIN_USER_READ],
  },
  {
    method: 'get',
    path: `/admin/users/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_USER_READ],
  },
  {
    method: 'post',
    path: `/admin/users/${NO_ID}/roles`,
    permissions: [P.REALM_ADMIN, P.ADMIN_USER_ASSIGN_ROLE],
  },
  {
    method: 'delete',
    path: `/admin/users/${NO_ID}/roles/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_USER_ASSIGN_ROLE],
  },
  {
    method: 'delete',
    path: `/admin/users/${NO_ID}`,
    permissions: [P.REALM_ADMIN, P.ADMIN_USER_DELETE],
  },
  // Audit
  {
    method: 'get',
    path: '/admin/audit-logs',
    permissions: [P.REALM_AUDIT, P.AUDIT_LOG_READ],
  },
  // Profiles
  {
    method: 'get',
    path: `/profiles/${NO_ID}`,
    permissions: [P.REALM_PROFILE, P.PROFILE_READ],
  },
  {
    method: 'patch',
    path: '/profiles/me',
    permissions: [P.REALM_PROFILE, P.PROFILE_UPDATE_OWN],
  },
  {
    method: 'patch',
    path: '/profiles/me/password',
    permissions: [P.REALM_PROFILE, P.PROFILE_UPDATE_OWN],
  },
  {
    method: 'delete',
    path: '/profiles/me',
    permissions: [P.REALM_PROFILE, P.PROFILE_DELETE_OWN],
    destructive: true,
  },
  // Tasks
  {
    method: 'post',
    path: '/tasks/cleanup-unverified-users',
    permissions: [P.REALM_TASK, P.TASK_CLEAN_USERS],
  },
  {
    method: 'post',
    path: '/tasks/cleanup-expired-tokens',
    permissions: [P.REALM_TASK, P.TASK_CLEAN_TOKENS],
  },
  {
    method: 'post',
    path: '/tasks/cleanup-orphaned-permissions',
    permissions: [P.REALM_TASK, P.TASK_CLEAN_PERMISSIONS],
  },
  {
    method: 'post',
    path: '/tasks/cleanup-audit-logs',
    permissions: [P.REALM_TASK, P.TASK_CLEAN_AUDIT],
  },
];

/** JWT required, no permission. */
const AUTHENTICATED_ROUTES: Route[] = [
  { method: 'get', path: '/auth/me' },
  { method: 'post', path: '/auth/logout-all' },
  { method: 'get', path: '/auth/sessions' },
  { method: 'delete', path: `/auth/sessions/${NO_ID}` },
];

/** No JWT (refresh/logout authenticate with the refresh token in the body). */
const PUBLIC_ROUTES: Route[] = [
  { method: 'get', path: '/' },
  { method: 'post', path: '/auth/register' },
  { method: 'post', path: '/auth/login' },
  { method: 'get', path: '/auth/verify-email' },
  { method: 'post', path: '/auth/resend-verification' },
  { method: 'post', path: '/auth/forgot-password' },
  { method: 'post', path: '/auth/reset-password' },
  { method: 'post', path: '/auth/refresh' },
  { method: 'post', path: '/auth/logout' },
];

/** "/admin/roles/999999" → "/admin/roles/:param" */
const pattern = (path: string) => path.replace(/\/(\d+|:[^/]+)/g, '/:param');

describe('Route security (e2e)', () => {
  let t: TestApp;

  /** One user per permission set (registration is slow because of bcrypt). */
  const tokenCache = new Map<string, Promise<string>>();
  const tokenFor = (perms: readonly Permission[]) => {
    const key = [...perms].sort().join(',');
    if (!tokenCache.has(key)) {
      tokenCache.set(
        key,
        createUserWithPermissions(t, perms).then((u) => u.accessToken),
      );
    }
    return tokenCache.get(key)!;
  };

  const call = (route: Route, token?: string) => {
    const req = request(t.http)[route.method](route.path);
    return token ? req.set(bearer(token)) : req;
  };

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  describe.each(PROTECTED_ROUTES)('$method $path', (route) => {
    it('401 without token', async () => {
      await call(route).expect(401);
    });

    it.each(route.permissions)('403 when missing "%s"', async (missing) => {
      const token = await tokenFor(
        route.permissions.filter((p) => p !== missing),
      );
      await call(route, token).expect(403);
    });

    it('access granted with exactly the required permissions', async () => {
      const token = route.destructive
        ? (await createUserWithPermissions(t, route.permissions)).accessToken
        : await tokenFor(route.permissions);
      const res = await call(route, token);
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe.each(AUTHENTICATED_ROUTES)('$method $path', (route) => {
    it('401 without token', async () => {
      await call(route).expect(401);
    });

    it('access granted to a user without any permission', async () => {
      const token = await tokenFor([]);
      const res = await call(route, token);
      expect([401, 403]).not.toContain(res.status);
    });
  });

  describe.each(PUBLIC_ROUTES)('$method $path', (route) => {
    it('reachable without token', async () => {
      const res = await call(route);
      expect([401, 403]).not.toContain(res.status);
    });
  });

  it('route inventory: every app route is listed in exactly one table', () => {
    const router = t.app.getHttpAdapter().getInstance().router;
    const appRoutes: string[] = router.stack
      .filter((layer: any) => layer.route)
      .flatMap((layer: any) =>
        Object.keys(layer.route.methods).map(
          (m) => `${m.toUpperCase()} ${pattern(layer.route.path)}`,
        ),
      );

    const listed = [
      ...PROTECTED_ROUTES,
      ...AUTHENTICATED_ROUTES,
      ...PUBLIC_ROUTES,
    ].map((r) => `${r.method.toUpperCase()} ${pattern(r.path)}`);

    expect(new Set(listed).size).toBe(listed.length); // no duplicates
    expect([...appRoutes].sort()).toEqual([...listed].sort());
  });

  it('sanity: a regular verified user (USER role) cannot reach admin routes', async () => {
    const user = await createVerifiedUser(t);
    await call(
      { method: 'get', path: '/admin/users' },
      user.accessToken,
    ).expect(403);
  });
});
