import request from 'supertest';
import { THROTTLE } from '../../src/common/constants.js';
import { createTestApp, type TestApp } from '../setup/app.factory.js';
import { createVerifiedUser, uniqueEmail } from '../setup/auth.helper.js';
import { cleanDatabase } from '../setup/db.js';
import { VALID_CAPTCHA } from '../setup/fake-turnstile.service.js';

const CAPTCHA_ROUTES = [
  {
    path: '/auth/register',
    body: () => ({
      email: uniqueEmail(),
      password: 'Password-123!',
      name: 'Captcha',
    }),
    status: 201,
  },
  {
    path: '/auth/login',
    body: () => ({ email: uniqueEmail(), password: 'Password-123!' }),
    status: 401,
  },
  {
    path: '/auth/forgot-password',
    body: () => ({ email: uniqueEmail() }),
    status: 201,
  },
  {
    path: '/auth/resend-verification',
    body: () => ({ email: uniqueEmail() }),
    status: 201,
  },
];

describe('Captcha (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await cleanDatabase(t.prisma);
  });

  beforeEach(() => {
    t.captcha.reset();
    t.captcha.enabled = true;
  });

  afterAll(() => t.app.close());

  const post = (path: string, body: object, token?: string) => {
    const req = request(t.http).post(path).send(body);
    return token ? req.set('X-Turnstile-Token', token) : req;
  };

  describe.each(CAPTCHA_ROUTES)('POST $path', ({ path, body, status }) => {
    it('400 captcha.missing without the token header', async () => {
      const res = await post(path, body()).expect(400);
      expect(res.body.code).toBe('captcha.missing');
    });

    it(`${status} with a valid token`, async () => {
      await post(path, body(), VALID_CAPTCHA).expect(status);
    });
  });

  describe('POST /auth/login', () => {
    const login = (token?: string, headers: Record<string, string> = {}) =>
      post(
        '/auth/login',
        { email: uniqueEmail(), password: 'Password-123!' },
        token,
      ).set(headers);

    it('403 captcha.invalid with a token rejected by Cloudflare', async () => {
      const res = await login('rejected-token').expect(403);
      expect(res.body.code).toBe('captcha.invalid');
    });

    it('503 captcha.unavailable when Cloudflare cannot answer', async () => {
      t.captcha.unavailable = true;
      const res = await login(VALID_CAPTCHA).expect(503);
      expect(res.body.code).toBe('captcha.unavailable');
    });

    it('needs no token when the captcha is disabled', async () => {
      t.captcha.enabled = false;
      await login().expect(401);
      expect(t.captcha.calls).toHaveLength(0);
    });

    it('logs in a verified user with a valid token', async () => {
      t.captcha.enabled = false;
      const user = await createVerifiedUser(t);
      t.captcha.enabled = true;
      await post(
        '/auth/login',
        { email: user.email, password: user.password },
        VALID_CAPTCHA,
      ).expect(201);
    });

    it('sends the client IP from CLIENT_IP_HEADER to Cloudflare', async () => {
      process.env.CLIENT_IP_HEADER = 'x-real-ip';
      try {
        await login(VALID_CAPTCHA, { 'X-Real-IP': '203.0.113.9' });
      } finally {
        delete process.env.CLIENT_IP_HEADER;
      }
      expect(t.captcha.calls).toEqual([
        { token: VALID_CAPTCHA, remoteIp: '203.0.113.9' },
      ]);
    });
  });

  it('POST /auth/refresh needs no captcha', async () => {
    await request(t.http)
      .post('/auth/refresh')
      .send({ refresh_token: 'not-a-token' })
      .expect(401);
    expect(t.captcha.calls).toHaveLength(0);
  });

  describe('with the real throttler', () => {
    let throttled: TestApp;

    beforeAll(async () => {
      throttled = await createTestApp({ throttle: true });
      throttled.captcha.enabled = true;
    });

    afterAll(() => throttled.app.close());

    it('throttles before calling Cloudflare', async () => {
      const login = () =>
        request(throttled.http)
          .post('/auth/login')
          .set('X-Turnstile-Token', 'rejected-token')
          .send({ email: uniqueEmail(), password: 'Password-123!' });

      for (let i = 0; i < THROTTLE.AUTH.limit; i++) {
        await login().expect(403);
      }
      await login().expect(429);
      expect(throttled.captcha.calls).toHaveLength(THROTTLE.AUTH.limit);
    });
  });
});
