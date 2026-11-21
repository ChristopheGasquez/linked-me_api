import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResponseCodes } from '../../common/constants/response-codes.js';
import {
  TURNSTILE_SERVER_ERRORS,
  TURNSTILE_TIMEOUT_MS,
  TURNSTILE_TOKEN_MAX_LENGTH,
  TURNSTILE_VERIFY_URL,
} from './turnstile.constants.js';

type SiteverifyResponse = { success: boolean; 'error-codes'?: string[] };

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secret: string | null;

  constructor(config: ConfigService) {
    this.secret =
      config.get('TURNSTILE_ENABLED') === 'true'
        ? config.getOrThrow<string>('TURNSTILE_SECRET_KEY')
        : null;
  }

  isEnabled(): boolean {
    return this.secret !== null;
  }

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    if (token.length > TURNSTILE_TOKEN_MAX_LENGTH) return false;

    let outcome: SiteverifyResponse;
    try {
      const res = await fetch(TURNSTILE_VERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secret,
          response: token,
          ...(remoteIp && { remoteip: remoteIp }),
        }),
        signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      outcome = (await res.json()) as SiteverifyResponse;
    } catch (error) {
      this.logger.error(`siteverify failed: ${(error as Error).message}`);
      throw captchaUnavailable();
    }

    if (outcome.success) return true;
    const codes = outcome['error-codes'] ?? [];
    if (codes.some((code) => TURNSTILE_SERVER_ERRORS.includes(code))) {
      this.logger.error(`siteverify rejected the request: ${codes.join(', ')}`);
      throw captchaUnavailable();
    }
    return false;
  }
}

const captchaUnavailable = () =>
  new ServiceUnavailableException({
    message: 'Captcha verification unavailable, try again later',
    code: ResponseCodes.CAPTCHA_UNAVAILABLE,
  });
