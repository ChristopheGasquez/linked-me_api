import { ServiceUnavailableException } from '@nestjs/common';

export const VALID_CAPTCHA = 'valid-captcha-token';

export class FakeTurnstileService {
  enabled = false;
  unavailable = false;
  readonly calls: { token: string; remoteIp?: string }[] = [];

  isEnabled(): boolean {
    return this.enabled;
  }

  verify(token: string, remoteIp?: string): Promise<boolean> {
    this.calls.push({ token, remoteIp });
    if (this.unavailable) {
      throw new ServiceUnavailableException({
        message: 'Captcha verification unavailable, try again later',
        code: 'captcha.unavailable',
      });
    }
    return Promise.resolve(token === VALID_CAPTCHA);
  }

  reset(): void {
    this.enabled = false;
    this.unavailable = false;
    this.calls.length = 0;
  }
}
