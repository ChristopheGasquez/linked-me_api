// Events emitted by core for the apps (which keep no FK to users)
export const UserEvents = {
  DELETED: 'user.deleted',
} as const;

export type UserDeletedEvent = { userId: string };
