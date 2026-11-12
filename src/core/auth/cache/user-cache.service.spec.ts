import { USER_CACHE_TTL_MS } from '../../../common/constants.js';
import { CachedUser, UserCacheService } from './user-cache.service.js';

const buildUser = (id: number): CachedUser => ({
  id,
  email: `user${id}@example.com`,
  name: `User ${id}`,
  isEmailChecked: true,
  failedLoginAttempts: 0,
  lockedUntil: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  roles: ['USER'],
  permissions: [],
});

describe('UserCacheService', () => {
  let cache: UserCacheService;

  beforeEach(() => {
    jest.useFakeTimers();
    cache = new UserCacheService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return null for an unknown user', () => {
    expect(cache.get(1)).toBeNull();
  });

  it('should return the cached data after set()', () => {
    const user = buildUser(1);
    cache.set(1, user);

    expect(cache.get(1)).toEqual(user);
  });

  it('should still return the data right before the TTL expires', () => {
    cache.set(1, buildUser(1));
    jest.advanceTimersByTime(USER_CACHE_TTL_MS);

    expect(cache.get(1)).not.toBeNull();
  });

  it('should return null and drop the entry once the TTL has expired', () => {
    cache.set(1, buildUser(1));
    jest.advanceTimersByTime(USER_CACHE_TTL_MS + 1);

    expect(cache.get(1)).toBeNull();
    // the entry is removed, so moving the clock back does not resurrect it
    jest.setSystemTime(Date.now() - USER_CACHE_TTL_MS);
    expect(cache.get(1)).toBeNull();
  });

  it('should invalidate only the given user', () => {
    cache.set(1, buildUser(1));
    cache.set(2, buildUser(2));

    cache.invalidate(1);

    expect(cache.get(1)).toBeNull();
    expect(cache.get(2)).not.toBeNull();
  });

  it('should clear every entry with invalidateAll()', () => {
    cache.set(1, buildUser(1));
    cache.set(2, buildUser(2));

    cache.invalidateAll();

    expect(cache.get(1)).toBeNull();
    expect(cache.get(2)).toBeNull();
  });
});
