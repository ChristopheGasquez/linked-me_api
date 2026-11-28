import { ConfigService } from '@nestjs/config';
import { getJwtSecret } from './jwt-secret.js';

const configWith = (secret: string) =>
  ({ getOrThrow: vi.fn().mockReturnValue(secret) }) as unknown as ConfigService;

describe('getJwtSecret', () => {
  it('should return a secret of at least 32 bytes', () => {
    expect(getJwtSecret(configWith('x'.repeat(32)))).toBe('x'.repeat(32));
  });

  it('should refuse a secret shorter than 32 bytes', () => {
    expect(() => getJwtSecret(configWith('x'.repeat(31)))).toThrow(
      'JWT_SECRET must be at least 32 bytes',
    );
  });

  it('should count bytes, not characters', () => {
    // 16 characters, 32 bytes in UTF-8
    expect(getJwtSecret(configWith('é'.repeat(16)))).toBe('é'.repeat(16));
  });
});
