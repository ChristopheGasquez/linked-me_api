import { ConfigService } from '@nestjs/config';

export const JWT_ALGORITHM = 'HS256';
const MIN_SECRET_BYTES = 32;

export function getJwtSecret(config: ConfigService): string {
  const secret = config.getOrThrow<string>('JWT_SECRET');
  if (Buffer.byteLength(secret, 'utf8') < MIN_SECRET_BYTES) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_BYTES} bytes`);
  }
  return secret;
}
