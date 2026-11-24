export const TaskCron = {
  UNVERIFIED_USERS: '0 */6 * * *',
  EXPIRED_TOKENS: '0 2 * * *',
  AUDIT_LOGS: '0 3 * * *',
} as const;

export const TASK_NAMES = [
  'unverified-users',
  'expired-tokens',
  'audit-logs',
  'orphaned-permissions',
] as const;

export type TaskName = (typeof TASK_NAMES)[number];
