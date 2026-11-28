import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ResponseCodes } from '../constants/response-codes.js';

type FieldError = { key: string; code: string; message?: string };

// Nested DTOs (arrays of objects) carry their errors in `children`:
// key = dotted path (categories.2.name), code = leaf property
const flatten = (errors: ValidationError[], parentKey?: string): FieldError[] =>
  errors.flatMap((e) => {
    const key = parentKey ? `${parentKey}.${e.property}` : e.property;
    if (!e.constraints && e.children?.length) {
      return flatten(e.children, key);
    }
    const constraint = Object.keys(e.constraints ?? {})[0];
    return [
      {
        key,
        code: `validation.${e.property}.${constraint}`,
        message: e.constraints?.[constraint],
      },
    ];
  });

export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const fields = flatten(errors);
  return new BadRequestException({
    message: fields[0]?.message ?? 'Validation failed',
    code: ResponseCodes.VALIDATION_FAILED,
    params: {
      fields: fields.map(({ key, code }) => ({ key, code })),
    },
  });
}
