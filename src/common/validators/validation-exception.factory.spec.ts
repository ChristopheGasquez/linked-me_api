import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { validationExceptionFactory } from './validation-exception.factory.js';

const error = (
  property: string,
  constraints?: Record<string, string>,
): ValidationError => ({ property, constraints, children: [] });

describe('validationExceptionFactory', () => {
  it('should return a BadRequestException with the first constraint message', () => {
    const exception = validationExceptionFactory([
      error('email', { isEmail: 'email must be an email' }),
      error('password', { minLength: 'password is too short' }),
    ]);

    expect(exception).toBeInstanceOf(BadRequestException);
    expect(exception.getResponse()).toMatchObject({
      message: 'email must be an email',
      code: 'validation.failed',
    });
  });

  it('should list every invalid field with a validation.<field>.<constraint> code', () => {
    const exception = validationExceptionFactory([
      error('email', { isEmail: 'email must be an email' }),
      error('password', { minLength: 'password is too short' }),
    ]);

    expect(exception.getResponse()).toMatchObject({
      params: {
        fields: [
          { key: 'email', code: 'validation.email.isEmail' },
          { key: 'password', code: 'validation.password.minLength' },
        ],
      },
    });
  });

  it('should only keep the first constraint of a field', () => {
    const exception = validationExceptionFactory([
      error('email', {
        isNotEmpty: 'email should not be empty',
        isEmail: 'email must be an email',
      }),
    ]);

    expect(exception.getResponse()).toMatchObject({
      message: 'email should not be empty',
      params: {
        fields: [{ key: 'email', code: 'validation.email.isNotEmpty' }],
      },
    });
  });

  it('should fall back to a generic message when the first error has no constraints', () => {
    const exception = validationExceptionFactory([error('address')]);

    expect(exception.getResponse()).toMatchObject({
      message: 'Validation failed',
      code: 'validation.failed',
      params: {
        fields: [{ key: 'address', code: 'validation.address.undefined' }],
      },
    });
  });

  it('should flatten nested errors with a dotted key and the leaf property in the code', () => {
    const exception = validationExceptionFactory([
      {
        property: 'categories',
        children: [
          {
            property: '2',
            children: [
              error('name', { maxLength: 'name is too long' }),
              error('color', { max: 'color must not be greater than 5' }),
            ],
          },
        ],
      },
      error('name', { isNotEmpty: 'name should not be empty' }),
    ]);

    expect(exception.getResponse()).toMatchObject({
      message: 'name is too long',
      params: {
        fields: [
          { key: 'categories.2.name', code: 'validation.name.maxLength' },
          { key: 'categories.2.color', code: 'validation.color.max' },
          { key: 'name', code: 'validation.name.isNotEmpty' },
        ],
      },
    });
  });
});
