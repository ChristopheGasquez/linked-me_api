import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service.js';
import { TURNSTILE_VERIFY_URL } from './turnstile.constants.js';

const config = (env: Record<string, string>) => new ConfigService(env);

const enabled = () =>
  new TurnstileService(
    config({ TURNSTILE_ENABLED: 'true', TURNSTILE_SECRET_KEY: 'secret' }),
  );

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe('TurnstileService', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('isEnabled()', () => {
    it('should be disabled unless TURNSTILE_ENABLED is "true"', () => {
      expect(new TurnstileService(config({})).isEnabled()).toBe(false);
      expect(
        new TurnstileService(
          config({ TURNSTILE_ENABLED: 'false' }),
        ).isEnabled(),
      ).toBe(false);
    });

    it('should be enabled with a secret key', () => {
      expect(enabled().isEnabled()).toBe(true);
    });

    it('should fail at boot when enabled without a secret key', () => {
      expect(
        () => new TurnstileService(config({ TURNSTILE_ENABLED: 'true' })),
      ).toThrow(/TURNSTILE_SECRET_KEY/);
    });
  });

  describe('verify()', () => {
    it('should send the secret, the token and the client IP to siteverify', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true }));

      await expect(enabled().verify('token', '203.0.113.9')).resolves.toBe(
        true,
      );

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(TURNSTILE_VERIFY_URL);
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        secret: 'secret',
        response: 'token',
        remoteip: '203.0.113.9',
      });
    });

    it('should omit remoteip when the client IP is unknown', async () => {
      fetchMock.mockResolvedValue(jsonResponse({ success: true }));

      await enabled().verify('token');

      const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
      expect(body).not.toHaveProperty('remoteip');
    });

    it.each([
      [['invalid-input-response']],
      [['timeout-or-duplicate']],
      [undefined],
    ])('should reject a token refused by Cloudflare (%j)', async (codes) => {
      fetchMock.mockResolvedValue(
        jsonResponse({ success: false, 'error-codes': codes }),
      );

      await expect(enabled().verify('token')).resolves.toBe(false);
    });

    it('should reject a token longer than 2048 characters without calling Cloudflare', async () => {
      await expect(enabled().verify('x'.repeat(2049))).resolves.toBe(false);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['a network error', () => fetchMock.mockRejectedValue(new Error('down'))],
      [
        'an HTTP error',
        () => fetchMock.mockResolvedValue(jsonResponse({}, 500)),
      ],
      [
        'a wrong secret key',
        () =>
          fetchMock.mockResolvedValue(
            jsonResponse({
              success: false,
              'error-codes': ['invalid-input-secret'],
            }),
          ),
      ],
    ])('should throw 503 captcha.unavailable on %s', async (_, arrange) => {
      arrange();

      const error = await enabled()
        .verify('token')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        message: 'Captcha verification unavailable, try again later',
        code: 'captcha.unavailable',
      });
    });
  });
});
