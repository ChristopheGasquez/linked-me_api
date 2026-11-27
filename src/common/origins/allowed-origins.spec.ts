import { getAllowedOrigins } from './allowed-origins.js';

describe('getAllowedOrigins', () => {
  const ENV_KEYS = [
    'ADMIN_ORIGINS',
    'APP_ORIGINS',
    'SWAGGER_ENABLED',
    'APP_URL',
  ];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('should split, trim and merge admin and app origins', () => {
    process.env.ADMIN_ORIGINS = ' https://admin.test , http://localhost:4200';
    process.env.APP_ORIGINS = 'https://app1.test,,https://admin.test';

    expect(getAllowedOrigins()).toEqual({
      admin: ['https://admin.test', 'http://localhost:4200'],
      all: ['https://admin.test', 'http://localhost:4200', 'https://app1.test'],
    });
  });

  it('should throw when ADMIN_ORIGINS is missing or empty', () => {
    expect(() => getAllowedOrigins()).toThrow(
      'ADMIN_ORIGINS must list at least one origin',
    );
    process.env.ADMIN_ORIGINS = ' , ';
    expect(() => getAllowedOrigins()).toThrow(
      'ADMIN_ORIGINS must list at least one origin',
    );
  });

  it.each([
    'admin.test',
    'https://admin.test/',
    'https://admin.test/path',
    'HTTPS://admin.test',
    '*',
  ])('should reject "%s", which is not an exact origin', (value) => {
    process.env.ADMIN_ORIGINS = value;
    expect(() => getAllowedOrigins()).toThrow(
      `ADMIN_ORIGINS: "${value}" is not an exact origin`,
    );
  });

  it('should validate APP_ORIGINS too', () => {
    process.env.ADMIN_ORIGINS = 'https://admin.test';
    process.env.APP_ORIGINS = 'https://app1.test/';
    expect(() => getAllowedOrigins()).toThrow('APP_ORIGINS');
  });

  it('should allow the API origin as admin when Swagger is enabled', () => {
    process.env.ADMIN_ORIGINS = 'https://admin.test';
    process.env.APP_URL = 'http://localhost:3000/';
    process.env.SWAGGER_ENABLED = 'true';

    expect(getAllowedOrigins().admin).toEqual([
      'https://admin.test',
      'http://localhost:3000',
    ]);
  });

  it('should not allow the API origin when Swagger is disabled', () => {
    process.env.ADMIN_ORIGINS = 'https://admin.test';
    process.env.APP_URL = 'http://localhost:3000';

    expect(getAllowedOrigins().admin).toEqual(['https://admin.test']);
  });
});
