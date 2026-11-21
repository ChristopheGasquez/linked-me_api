export const TURNSTILE_HEADER = 'x-turnstile-token';
export const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;
export const TURNSTILE_TIMEOUT_MS = 5000;
export const TURNSTILE_SERVER_ERRORS = [
  'missing-input-secret',
  'invalid-input-secret',
  'bad-request',
  'internal-error',
];
