import { USER_CACHE_TTL_MS } from '../../../common/constants.js';
import { CachedUser, UserCacheService } from './user-cache.service.js';
import { testId } from '../../../../test/setup/test-id.js';

const buildUser = (n: number): CachedUser => ({
  id: testId(n),
  email: `user${n}@example.com`,
  name: `User ${n}`,
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
    vi.useFakeTimers();
    cache = new UserCacheService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null for an unknown user', () => {
    expect(cache.get(testId(1))).toBeNull();
  });

  it('should return the cached data after set()', () => {
    const user = buildUser(1);
    cache.set(testId(1), user);

    expect(cache.get(testId(1))).toEqual(user);
  });

  it('should still return the data right before the TTL expires', () => {
    cache.set(testId(1), buildUser(1));
    vi.advanceTimersByTime(USER_CACHE_TTL_MS);

    expect(cache.get(testId(1))).not.toBeNull();
  });

  it('should return null and drop the entry once the TTL has expired', () => {
    cache.set(testId(1), buildUser(1));
    vi.advanceTimersByTime(USER_CACHE_TTL_MS + 1);

    expect(cache.get(testId(1))).toBeNull();
    // the entry is removed, so moving the clock back does not resurrect it
    vi.setSystemTime(Date.now() - USER_CACHE_TTL_MS);
    expect(cache.get(testId(1))).toBeNull();
  });

  it('should invalidate only the given user', () => {
    cache.set(testId(1), buildUser(1));
    cache.set(testId(2), buildUser(2));

    cache.invalidate(testId(1));

    expect(cache.get(testId(1))).toBeNull();
    expect(cache.get(testId(2))).not.toBeNull();
  });

  it('should clear every entry with invalidateAll()', () => {
    cache.set(testId(1), buildUser(1));
    cache.set(testId(2), buildUser(2));

    cache.invalidateAll();

    expect(cache.get(testId(1))).toBeNull();
    expect(cache.get(testId(2))).toBeNull();
  });
});
