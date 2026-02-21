import { Injectable } from '@nestjs/common';
import { USER_CACHE_TTL_MS } from '../../common/constants.js';

export interface CachedUser {
  id: number;
  email: string;
  name: string;
  isEmailChecked: boolean;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
  permissions: string[];
}

@Injectable()
export class UserCacheService {
  private readonly cache = new Map<
    number,
    { data: CachedUser; expiresAt: number }
  >();

  get(userId: number): CachedUser | null {
    const entry = this.cache.get(userId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(userId);
      return null;
    }
    return entry.data;
  }

  set(userId: number, data: CachedUser): void {
    this.cache.set(userId, { data, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  }

  invalidate(userId: number): void {
    this.cache.delete(userId);
  }

  invalidateAll(): void {
    this.cache.clear();
  }
}
