import type { Mocked } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy.js';
import { CachedUser, UserCacheService } from '../cache/user-cache.service.js';
import {
  createPrismaServiceMock,
  PrismaServiceMock,
} from '../../prisma/prisma.service.mock.js';

const dbUser = {
  id: 1,
  email: 'test@example.com',
  password: 'hashed_password',
  name: 'Test User',
  isEmailChecked: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  roles: [
    {
      role: {
        name: 'USER',
        permissions: [{ permission: { name: 'profile:read' } }],
      },
    },
    {
      role: {
        name: 'ADMIN',
        permissions: [
          { permission: { name: 'user:read' } },
          { permission: { name: 'user:delete' } },
        ],
      },
    },
  ],
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: PrismaServiceMock;
  let userCache: Mocked<Pick<UserCacheService, 'get' | 'set'>>;

  beforeEach(() => {
    prisma = createPrismaServiceMock();
    userCache = { get: vi.fn().mockReturnValue(null), set: vi.fn() };
    const config = {
      getOrThrow: vi.fn().mockReturnValue('jwt_secret'),
    } as unknown as ConfigService;

    strategy = new JwtStrategy(
      prisma,
      config,
      userCache as unknown as UserCacheService,
    );
  });

  it('should return the cached user without querying the database', async () => {
    const cached = { id: 1, roles: ['USER'] } as CachedUser;
    userCache.get.mockReturnValue(cached);

    const result = await strategy.validate({
      sub: 1,
      email: 'test@example.com',
    });

    expect(result).toBe(cached);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if the user no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 1, email: 'test@example.com' }),
    ).rejects.toThrow(UnauthorizedException);
    expect(userCache.set).not.toHaveBeenCalled();
  });

  it('should flatten roles and permissions, strip the password and cache the result', async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser as any);

    const result = await strategy.validate({
      sub: 1,
      email: 'test@example.com',
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
    expect(result).not.toHaveProperty('password');
    expect(result).toMatchObject({
      id: 1,
      email: 'test@example.com',
      roles: ['USER', 'ADMIN'],
      permissions: ['profile:read', 'user:read', 'user:delete'],
    });
    expect(userCache.set).toHaveBeenCalledWith(1, result);
  });
});
