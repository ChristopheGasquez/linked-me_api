import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsOptional, IsString, validate } from 'class-validator';
import { Trim, TrimLowerCase, TrimUpperCase } from './transforms.js';
import { RegisterDto } from '../../core/auth/dto/register.dto.js';
import { LoginDto } from '../../core/auth/dto/login.dto.js';
import { CreateRoleDto } from '../../core/admin/roles/dto/create-role.dto.js';
import { AssignRoleDto } from '../../core/admin/users/dto/assign-role.dto.js';
import { FindUsersQueryDto } from '../../core/admin/users/dto/find-users-query.dto.js';

class SampleDto {
  @Trim() @IsOptional() @IsString() trimmed?: unknown;
  @TrimLowerCase() @IsOptional() @IsString() lower?: unknown;
  @TrimUpperCase() @IsOptional() @IsString() upper?: unknown;
}

const failedProps = async (obj: object) =>
  (await validate(obj)).map((e) => e.property);

describe('string transforms', () => {
  // ─────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────
  describe('helpers', () => {
    it('should trim, lowercase and uppercase strings', () => {
      const dto = plainToInstance(SampleDto, {
        trimmed: '  Jean  ',
        lower: '  Jean@Mail.COM ',
        upper: ' premium_user ',
      });

      expect(dto.trimmed).toBe('Jean');
      expect(dto.lower).toBe('jean@mail.com');
      expect(dto.upper).toBe('PREMIUM_USER');
    });

    it('should leave non-string values untouched so validation rejects them', async () => {
      const dto = plainToInstance(SampleDto, {
        trimmed: 42,
        lower: null,
        upper: ['a'],
      });

      expect(dto.trimmed).toBe(42);
      expect(dto.upper).toEqual(['a']);
      expect(await failedProps(dto)).toEqual(['trimmed', 'upper']);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Email normalization
  // ─────────────────────────────────────────────────────────────
  describe('email', () => {
    it('should normalize email on register and keep it valid', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: '  Jean@Mail.COM ',
        password: 'Password123!',
        name: '  Jean Dupont  ',
      });

      expect(dto.email).toBe('jean@mail.com');
      expect(dto.name).toBe('Jean Dupont');
      expect(await failedProps(dto)).toEqual([]);
    });

    it('should normalize email on login without touching password', () => {
      const dto = plainToInstance(LoginDto, {
        email: 'JEAN@mail.com ',
        password: ' secret with spaces ',
      });

      expect(dto.email).toBe('jean@mail.com');
      expect(dto.password).toBe(' secret with spaces ');
    });

    it('should reject a whitespace-only name after trim', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'jean@mail.com',
        password: 'Password123!',
        name: '    ',
      });

      expect(await failedProps(dto)).toEqual(['name']);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Role names
  // ─────────────────────────────────────────────────────────────
  describe('role names', () => {
    it('should uppercase and accept a valid role name', async () => {
      const dto = plainToInstance(CreateRoleDto, { name: ' premium_user ' });

      expect(dto.name).toBe('PREMIUM_USER');
      expect(await failedProps(dto)).toEqual([]);
    });

    it.each(['premium user', '1ROLE', 'ROLE-X', '_ROLE', 'rôle'])(
      'should reject invalid role name "%s"',
      async (name) => {
        const dto = plainToInstance(CreateRoleDto, { name });

        expect(await failedProps(dto)).toEqual(['name']);
      },
    );

    it('should uppercase role on assignment and on users filter', () => {
      expect(plainToInstance(AssignRoleDto, { role: ' admin ' }).role).toBe(
        'ADMIN',
      );
      expect(plainToInstance(FindUsersQueryDto, { role: 'admin' }).role).toBe(
        'ADMIN',
      );
    });
  });
});
