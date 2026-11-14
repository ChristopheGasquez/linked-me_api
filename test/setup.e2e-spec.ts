import request from 'supertest';
import { createTestApp, type TestApp } from './setup/app.factory.js';
import {
  bearer,
  createVerifiedUser,
  login,
  loginAsAdmin,
} from './setup/auth.helper.js';
import { cleanDatabase } from './setup/db.js';

/** Checks the E2E tooling itself, so other suites can rely on it. */
describe('E2E tooling (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  afterAll(() => t.app.close());

  it('createVerifiedUser returns working tokens', async () => {
    const user = await createVerifiedUser(t);

    const res = await request(t.http)
      .get('/auth/me')
      .set(bearer(user.accessToken))
      .expect(200);
    expect(res.body.email).toBe(user.email);
  });

  it('fake mail captures the verification token instead of sending it', async () => {
    const user = await createVerifiedUser(t);

    const mails = t.mail.sent.filter((m) => m.to === user.email);
    expect(mails).toEqual([
      expect.objectContaining({
        type: 'verification',
        token: expect.any(String),
      }),
    ]);
  });

  it('throttling is disabled (no 429 beyond the login limit)', async () => {
    const user = await createVerifiedUser(t);

    // THROTTLE.AUTH allows 10 logins / 15 min
    for (let i = 0; i < 12; i++) {
      await login(t, user.email, user.password);
    }
  });

  it('cleanDatabase removes test users but keeps the admin', async () => {
    const user = await createVerifiedUser(t);

    await cleanDatabase(t.prisma);

    expect(
      await t.prisma.user.findUnique({ where: { email: user.email } }),
    ).toBeNull();
    expect(await t.prisma.role.count()).toBe(2);
    await loginAsAdmin(t);
  });
});
