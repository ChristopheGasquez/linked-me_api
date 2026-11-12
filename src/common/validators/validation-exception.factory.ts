import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ResponseCodes } from '../constants/response-codes.js';

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const first = errors[0];
  const firstConstraint = Object.keys(first.constraints ?? {})[0];
  return new BadRequestException({
    message: first.constraints?.[firstConstraint] ?? 'Validation failed',
    code: ResponseCodes.VALIDATION_FAILED,
    params: {
      fields: errors.map((e) => {
        const constraint = Object.keys(e.constraints ?? {})[0];
        return {
          key: e.property,
          code: `validation.${e.property}.${constraint}`,
        };
      }),
    },
  });
}
