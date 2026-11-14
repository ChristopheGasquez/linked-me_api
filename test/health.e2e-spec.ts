import request from 'supertest';
import { createTestApp, type TestApp } from './setup/app.factory.js';

describe('Health (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.app.close());

  it('GET / → 200 with status and version', async () => {
    const res = await request(t.http).get('/').expect(200);
    expect(res.body).toEqual({
      status: 'ok',
      version: expect.any(String),
      documentation: '/docs',
    });
  });
});
