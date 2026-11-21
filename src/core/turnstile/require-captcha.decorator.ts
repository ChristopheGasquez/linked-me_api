import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../../common/dto/error-response.dto.js';
import { TurnstileGuard } from './turnstile.guard.js';

export const RequireCaptcha = () =>
  applyDecorators(
    UseGuards(TurnstileGuard),
    ApiHeader({
      name: 'X-Turnstile-Token',
      required: false,
      description:
        'Cloudflare Turnstile token (single use). Required when the captcha is enabled (always in production).',
    }),
    ApiResponse({
      status: 503,
      description:
        'Captcha verification unavailable — code: captcha.unavailable',
      type: ErrorResponseDto,
    }),
  );
