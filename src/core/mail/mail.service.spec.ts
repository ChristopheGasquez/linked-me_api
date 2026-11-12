const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service.js';

const buildService = (env: Record<string, string | undefined>) => {
  const config = {
    getOrThrow: jest.fn((key: string) => {
      const value = env[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    }),
    get: jest.fn((key: string, fallback?: unknown) => env[key] ?? fallback),
  } as unknown as ConfigService;
  return new MailService(config);
};

const sentHtml = (): string => sendMock.mock.calls[0][0].html;

describe('MailService', () => {
  const baseEnv = {
    RESEND_API_KEY: 'resend_key',
    MAIL_FROM: 'noreply@linked-me.test',
    APP_URL: 'https://api.linked-me.test',
  };

  beforeEach(() => {
    sendMock.mockReset().mockResolvedValue({});
  });

  describe('sendVerificationEmail()', () => {
    it('should add the token to the callbackUrl and keep its existing query params', async () => {
      const service = buildService(baseEnv);

      await service.sendVerificationEmail(
        'to@example.com',
        'Alice',
        'tok123',
        'https://app.linked-me.test/verify?lang=fr',
      );

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@linked-me.test',
          to: 'to@example.com',
        }),
      );
      expect(sentHtml()).toContain(
        'href="https://app.linked-me.test/verify?lang=fr&token=tok123"',
      );
    });

    it('should link to the API verify endpoint when no callbackUrl is given', async () => {
      const service = buildService(baseEnv);

      await service.sendVerificationEmail('to@example.com', 'Alice', 'tok123');

      expect(sentHtml()).toContain(
        'href="https://api.linked-me.test/auth/verify-email?token=tok123"',
      );
    });
  });

  describe('sendPasswordResetEmail()', () => {
    it('should add the token to the callbackUrl', async () => {
      const service = buildService(baseEnv);

      await service.sendPasswordResetEmail(
        'to@example.com',
        'Alice',
        'tok456',
        'http://localhost:4200/reset',
      );

      expect(sentHtml()).toContain(
        'href="http://localhost:4200/reset?token=tok456"',
      );
    });

    it('should use FRONTEND_URL when no callbackUrl is given', async () => {
      const service = buildService({
        ...baseEnv,
        FRONTEND_URL: 'https://app.linked-me.test',
      });

      await service.sendPasswordResetEmail('to@example.com', 'Alice', 'tok456');

      expect(sentHtml()).toContain(
        'href="https://app.linked-me.test/reset-password?token=tok456"',
      );
    });

    it('should fall back to APP_URL when FRONTEND_URL is not set', async () => {
      const service = buildService(baseEnv);

      await service.sendPasswordResetEmail('to@example.com', 'Alice', 'tok456');

      expect(sentHtml()).toContain(
        'href="https://api.linked-me.test/reset-password?token=tok456"',
      );
    });
  });

  describe('sendAccountLockedEmail()', () => {
    it('should send the lock notice to the user', async () => {
      const service = buildService(baseEnv);

      await service.sendAccountLockedEmail('to@example.com', 'Alice');

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'noreply@linked-me.test',
          to: 'to@example.com',
        }),
      );
      expect(sentHtml()).toContain('Bonjour Alice');
    });
  });

  it('should default the sender to onboarding@resend.dev when MAIL_FROM is not set', async () => {
    const service = buildService({ ...baseEnv, MAIL_FROM: undefined });

    await service.sendAccountLockedEmail('to@example.com', 'Alice');

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'onboarding@resend.dev' }),
    );
  });
});
