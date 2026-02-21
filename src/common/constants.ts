export const BCRYPT_ROUNDS = 10;

export const THROTTLE = {
  AUTH: { limit: 10, ttl: 900_000 }, // 10 req / 15 min
  SENSITIVE: { limit: 3, ttl: 3_600_000 }, // 3 req / 1 h
  PASSWORD_RESET: { limit: 5, ttl: 900_000 }, // 5 req / 15 min
  GLOBAL: { ttl: 60_000, limit: 60 }, // 60 req / min
} as const;

export const MS_PER_HOUR = 60 * 60 * 1000;
export const MS_PER_DAY = 24 * MS_PER_HOUR;
