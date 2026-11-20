import { Logger } from '@nestjs/common';
import request from 'supertest';
import { THROTTLE } from '../src/common/constants.js';
import { createTestApp, type TestApp } from './setup/app.factory.js';

/**
 * Rate limiting with the real throttler (disabled in the other E2E suites).
 * Logins on an unknown email: 401, no account lockout, no database write.
 */
const LIMIT = THROTTLE.AUTH.limit;

describe('Throttling (e2e)', () => {
  const login = (t: TestApp, forwardedFor?: string) => {
    const req = request(t.http)
      .post('/auth/login')
      .send({ email: 'nobody@test.local', password: 'Password-123!' });
    return forwardedFor ? req.set('X-Forwarded-For', forwardedFor) : req;
  };

  /** Sends LIMIT logins (all 401), then checks the next one is throttled. */
  async function exhaust(t: TestApp, forwardedFor?: string) {
    for (let i = 0; i < LIMIT; i++) {
      await login(t, forwardedFor).expect(401);
    }
    const res = await login(t, forwardedFor).expect(429);
    expect(res.body.code).toBe('throttle.too_many_requests');
  }

  describe('without TRUST_PROXY', () => {
    let t: TestApp;

    beforeAll(async () => {
      delete process.env.TRUST_PROXY;
      t = await createTestApp({ throttle: true });
    });

    afterAll(() => t.app.close());

    it(`429 after ${LIMIT} logins, and X-Forwarded-For cannot dodge it`, async () => {
      await exhaust(t);

      await login(t, '198.51.100.1').expect(429);
      await login(t, '198.51.100.2').expect(429);
    });
  });

  describe('with TRUST_PROXY=1', () => {
    let t: TestApp;

    beforeAll(async () => {
      process.env.TRUST_PROXY = '1';
      process.env.LOG_CLIENT_IP = 'true';
      t = await createTestApp({ throttle: true });
    });

    afterAll(async () => {
      delete process.env.TRUST_PROXY;
      delete process.env.LOG_CLIENT_IP;
      await t.app.close();
    });

    it('LOG_CLIENT_IP logs the client IP resolved from X-Forwarded-For', async () => {
      const spy = vi.spyOn(Logger.prototype, 'log');
      try {
        await request(t.http).get('/').set('X-Forwarded-For', '203.0.113.9');

        const logged = spy.mock.calls
          .map(([message]) => String(message))
          .find((m) => m.includes('203.0.113.9'));
        expect(JSON.parse(logged!)).toMatchObject({
          method: 'GET',
          path: '/',
          ip: '203.0.113.9',
          xForwardedFor: '203.0.113.9',
        });
      } finally {
        spy.mockRestore();
      }
    });

    it('counts each client IP (X-Forwarded-For) separately', async () => {
      await exhaust(t, '10.0.0.1');

      await login(t, '10.0.0.2').expect(401);
    });
  });
});
