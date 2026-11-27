import request from 'supertest';
import { createTestApp, type TestApp } from '../setup/app.factory.js';

// .env.test / CI: ADMIN_ORIGINS=http://localhost:4200, APP_ORIGINS=http://localhost:4300
const ADMIN_ORIGIN = 'http://localhost:4200';
const APP_ORIGIN = 'http://localhost:4300';
const EVIL_ORIGIN = 'https://evil.test';

const ADMIN_ROUTES = [
  '/admin/users',
  '/admin/roles',
  '/admin/audit-logs',
  '/tasks',
];

describe('Origin guard + CORS (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.app.close());

  describe.each(ADMIN_ROUTES)('admin zone %s', (route) => {
    it('→ 403 origin.not_allowed from an app origin', async () => {
      const res = await request(t.http)
        .get(route)
        .set('Origin', APP_ORIGIN)
        .expect(403);
      expect(res.body.code).toBe('origin.not_allowed');
    });

    it('→ passes the guard from the admin origin (401 without token)', async () => {
      const res = await request(t.http)
        .get(route)
        .set('Origin', ADMIN_ORIGIN)
        .expect(401);
      expect(res.headers['access-control-allow-origin']).toBe(ADMIN_ORIGIN);
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  it('GET /profiles/me from an app origin → passes the guard (401 without token)', async () => {
    const res = await request(t.http)
      .get('/profiles/me')
      .set('Origin', APP_ORIGIN)
      .expect(401);
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
  });

  it('POST /auth/login from an unknown origin → 403 without CORS headers', async () => {
    const res = await request(t.http)
      .post('/auth/login')
      .set('Origin', EVIL_ORIGIN)
      .send({ email: 'nobody@test.local', password: 'Password-123!' })
      .expect(403);
    expect(res.body.code).toBe('origin.not_allowed');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('Origin: null → 403', async () => {
    const res = await request(t.http)
      .get('/profiles/me')
      .set('Origin', 'null')
      .expect(403);
    expect(res.body.code).toBe('origin.not_allowed');
  });

  it('no Origin header (non-browser client) → passes the guard', async () => {
    await request(t.http).get('/admin/users').expect(401);
  });

  it('preflight from an allowed origin → CORS headers with credentials', async () => {
    const res = await request(t.http)
      .options('/auth/login')
      .set('Origin', APP_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(APP_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('preflight from an unknown origin → no CORS headers', async () => {
    const res = await request(t.http)
      .options('/auth/login')
      .set('Origin', EVIL_ORIGIN)
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
