import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard.js';
import { TurnstileService } from './turnstile.service.js';

describe('TurnstileGuard', () => {
  const turnstile = {
    isEnabled: vi.fn(),
    verify: vi.fn(),
  };
  const guard = new TurnstileGuard(turnstile as unknown as TurnstileService);

  const context = (headers: Record<string, unknown>) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ ip: '203.0.113.9', headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    turnstile.isEnabled.mockReturnValue(true);
    turnstile.verify.mockResolvedValue(true);
  });

  afterEach(() => vi.resetAllMocks());

  it('should let every request through when the captcha is disabled', async () => {
    turnstile.isEnabled.mockReturnValue(false);

    await expect(guard.canActivate(context({}))).resolves.toBe(true);
    expect(turnstile.verify).not.toHaveBeenCalled();
  });

  it.each([[undefined], [' '], [['a', 'b']]])(
    'should throw 400 captcha.missing when the token is %j',
    async (token) => {
      const error = await guard
        .canActivate(context({ 'x-turnstile-token': token }))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'captcha.missing',
      });
      expect(turnstile.verify).not.toHaveBeenCalled();
    },
  );

  it('should throw 403 captcha.invalid when Cloudflare rejects the token', async () => {
    turnstile.verify.mockResolvedValue(false);

    const error = await guard
      .canActivate(context({ 'x-turnstile-token': 'bad' }))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'captcha.invalid',
    });
  });

  it('should verify the trimmed token with the client IP', async () => {
    await expect(
      guard.canActivate(context({ 'x-turnstile-token': ' good ' })),
    ).resolves.toBe(true);
    expect(turnstile.verify).toHaveBeenCalledWith('good', '203.0.113.9');
  });
});
