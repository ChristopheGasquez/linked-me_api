import request from 'supertest';
import { THROTTLE } from '../src/common/constants.js';
import { createTestApp, type TestApp } from './setup/app.factory.js';

/**
 * Rate limiting with the real throttler (disabled in the other E2E suites).
 * Logins on an unknown email: 401, no account lockout, no database write.
 */
const LIMIT = THROTTLE.AUTH.limit;

describe('Throttling (e2e)', () => {
  const login = (t: TestApp, headers: Record<string, string> = {}) =>
    request(t.http)
      .post('/auth/login')
      .set(headers)
      .send({ email: 'nobody@test.local', password: 'Password-123!' });

  /** Sends LIMIT logins (all 401), then checks the next one is throttled. */
  async function exhaust(t: TestApp, headers: Record<string, string> = {}) {
    for (let i = 0; i < LIMIT; i++) {
      await login(t, headers).expect(401);
    }
    const res = await login(t, headers).expect(429);
    expect(res.body.code).toBe('throttle.too_many_requests');
  }

  describe('without CLIENT_IP_HEADER', () => {
    let t: TestApp;

    beforeAll(async () => {
      delete process.env.CLIENT_IP_HEADER;
      t = await createTestApp({ throttle: true });
    });

    afterAll(() => t.app.close());

    it(`429 after ${LIMIT} logins, and client IP headers cannot dodge it`, async () => {
      await exhaust(t);

      await login(t, { 'X-Real-IP': '198.51.100.1' }).expect(429);
      await login(t, { 'X-Forwarded-For': '198.51.100.2' }).expect(429);
    });
  });

  describe('with CLIENT_IP_HEADER=x-real-ip', () => {
    let t: TestApp;

    beforeAll(async () => {
      process.env.CLIENT_IP_HEADER = 'x-real-ip';
      t = await createTestApp({ throttle: true });
    });

    afterAll(async () => {
      delete process.env.CLIENT_IP_HEADER;
      await t.app.close();
    });

    it('counts each client IP (X-Real-IP) separately', async () => {
      await exhaust(t, { 'X-Real-IP': '10.0.0.1' });

      await login(t, { 'X-Real-IP': '10.0.0.2' }).expect(401);
    });

    it('ignores X-Forwarded-For', async () => {
      await login(t, {
        'X-Real-IP': '10.0.0.1',
        'X-Forwarded-For': '10.0.0.3',
      }).expect(429);
    });
  });
});
