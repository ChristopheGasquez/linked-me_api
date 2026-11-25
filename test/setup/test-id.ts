/** Deterministic, valid UUID v7 for tests: testId(1) → 00000000-0000-7000-8000-000000000001 */
export const testId = (n: number): string =>
  `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;

/** Valid UUID v7 that never exists in the database (real ids start with a recent timestamp). */
export const UNKNOWN_ID = testId(999999);
