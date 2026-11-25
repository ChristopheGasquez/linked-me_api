import request from 'supertest';
import type { Prisma } from '../../generated/prisma/client.js';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import {
  bearer,
  createVerifiedUser,
  loginAsAdmin,
  type AuthTokens,
} from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';
import { testId } from '../setup/test-id.js';

let actionCounter = 0;
/** Unique action name, so each test only sees its own logs. */
const uniqueAction = () => `test.e2e.${Date.now()}.${++actionCounter}`;

describe('Audit logs (e2e)', () => {
  let t: TestApp;
  let admin: AuthTokens;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
    admin = await loginAsAdmin(t);
  });

  afterAll(() => t.app.close());

  const list = (query: Record<string, unknown>) =>
    request(t.http)
      .get('/admin/audit-logs')
      .set(bearer(admin.accessToken))
      .query(query);

  const createLog = (data: {
    action: string;
    actorId?: string | null;
    targetId?: string | null;
    targetType?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) => t.prisma.auditLog.create({ data });

  it('200 returns a paginated list with every field of the log', async () => {
    const action = uniqueAction();
    const log = await createLog({
      action,
      actorId: admin.userId,
      targetId: testId(42),
      targetType: 'user',
      metadata: { foo: 'bar' },
    });

    const res = await list({ action }).expect(200);

    expect(res.body.data).toEqual([
      {
        id: log.id,
        action,
        actorId: admin.userId,
        targetId: testId(42),
        targetType: 'user',
        metadata: { foo: 'bar' },
        createdAt: log.createdAt.toISOString(),
      },
    ]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  });

  it('records real actions made through the API (profile update)', async () => {
    const user = await createVerifiedUser(t);
    await request(t.http)
      .patch('/profiles/me')
      .set(bearer(user.accessToken))
      .send({ name: 'Audited' })
      .expect(200);

    const res = await list({
      action: 'profile.update',
      actorId: user.userId,
    }).expect(200);

    expect(res.body.data).toEqual([
      expect.objectContaining({
        action: 'profile.update',
        actorId: user.userId,
        targetId: user.userId,
        targetType: 'user',
      }),
    ]);
  });

  it('filters by actorId and targetType, combined with action', async () => {
    const action = uniqueAction();
    const other = await createVerifiedUser(t);
    await createLog({ action, actorId: admin.userId, targetType: 'user' });
    await createLog({ action, actorId: admin.userId, targetType: 'role' });
    await createLog({ action, actorId: other.userId, targetType: 'user' });

    const byActor = await list({ action, actorId: other.userId }).expect(200);
    expect(byActor.body.data).toHaveLength(1);
    expect(byActor.body.data[0].actorId).toBe(other.userId);

    const byType = await list({ action, targetType: 'role' }).expect(200);
    expect(byType.body.data).toHaveLength(1);
    expect(byType.body.data[0].targetType).toBe('role');

    const both = await list({
      action,
      actorId: admin.userId,
      targetType: 'user',
    }).expect(200);
    expect(both.body.data).toHaveLength(1);
  });

  it('filters by targetId, alone and combined with targetType and actorId', async () => {
    const action = uniqueAction();
    const other = await createVerifiedUser(t);
    await createLog({
      action,
      actorId: admin.userId,
      targetId: testId(7),
      targetType: 'user',
    });
    await createLog({
      action,
      actorId: admin.userId,
      targetId: testId(7),
      targetType: 'role',
    });
    await createLog({
      action,
      actorId: other.userId,
      targetId: testId(7),
      targetType: 'user',
    });
    await createLog({
      action,
      actorId: admin.userId,
      targetId: testId(8),
      targetType: 'user',
    });

    const byTarget = await list({ action, targetId: testId(7) }).expect(200);
    expect(byTarget.body.data).toHaveLength(3);

    const withType = await list({
      action,
      targetId: testId(7),
      targetType: 'user',
    }).expect(200);
    expect(withType.body.data).toHaveLength(2);

    const withActor = await list({
      action,
      targetId: testId(7),
      targetType: 'user',
      actorId: other.userId,
    }).expect(200);
    expect(withActor.body.data).toHaveLength(1);
    expect(withActor.body.data[0]).toMatchObject({
      actorId: other.userId,
      targetId: testId(7),
    });
  });

  it('paginates and sorts by id', async () => {
    const action = uniqueAction();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      ids.push((await createLog({ action })).id);
    }

    const page1 = await list({
      action,
      limit: 2,
      sortBy: 'id',
      sortOrder: 'asc',
    }).expect(200);
    expect(page1.body.data.map((l: { id: string }) => l.id)).toEqual(
      ids.slice(0, 2),
    );
    expect(page1.body.meta).toMatchObject({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
      sortBy: 'id',
      sortOrder: 'asc',
    });

    const page2 = await list({
      action,
      limit: 2,
      page: 2,
      sortBy: 'id',
      sortOrder: 'asc',
    }).expect(200);
    expect(page2.body.data.map((l: { id: string }) => l.id)).toEqual([ids[2]]);
  });

  it.each([
    ['sortBy=action (not allowed)', { sortBy: 'action' }],
    ['sortOrder=up', { sortOrder: 'up' }],
    ['actorId=abc', { actorId: 'abc' }],
    ['actorId=UUID v4', { actorId: '0b5f3c1e-8a2d-4f6b-9c7e-1d2a3b4c5d6e' }],
    ['targetId=abc', { targetId: 'abc' }],
    ['targetId=UUID v4', { targetId: '0b5f3c1e-8a2d-4f6b-9c7e-1d2a3b4c5d6e' }],
    ['limit=101', { limit: 101 }],
    ['page=0', { page: 0 }],
  ])('400 validation.failed for %s', async (_label, query) => {
    const res = await list(query).expect(400);
    expect(res.body.code).toBe('validation.failed');
  });
});
