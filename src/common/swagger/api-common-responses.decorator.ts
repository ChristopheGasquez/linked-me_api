import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from '../dto/error-response.dto.js';
import { ValidationErrorResponseDto } from '../dto/validation-error-response.dto.js';

/** 401 + 403 for routes behind JwtAuthGuard + PermissionsGuard */
export const ApiAuthErrors = () =>
  applyDecorators(
    ApiResponse({
      status: 401,
      description:
        'Not authenticated (missing, invalid or expired access token)',
      type: ErrorResponseDto,
    }),
    ApiResponse({
      status: 403,
      description: 'Missing required permission(s)',
      type: ErrorResponseDto,
    }),
  );

/** 429 from the global throttler (60 req/min) */
export const ApiThrottleError = () =>
  ApiResponse({
    status: 429,
    description:
      'Too many requests — code: throttle.too_many_requests, params.retryAfter: seconds until retry',
    type: ErrorResponseDto,
  });

/** 400 from the global ValidationPipe (body / query DTOs) */
export const ApiValidationError = (
  description = 'Validation failed — code: validation.failed',
) =>
  ApiResponse({ status: 400, description, type: ValidationErrorResponseDto });

/** 400 from ParseIntPipe on numeric path params */
export const ApiInvalidIdError = () =>
  ApiResponse({
    status: 400,
    description:
      'Invalid ID, must be an integer (no code — message: "Validation failed (numeric string is expected)")',
    type: ErrorResponseDto,
  });
