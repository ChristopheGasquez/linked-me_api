// Toutes les permissions de l'application
// Utilisé par le seed, les guards et les controllers
export const Permissions = {
  // User
  USER_READ: 'user:read',
  USER_UPDATE_OWN: 'user:update:own',
  USER_DELETE_OWN: 'user:delete:own',
  USER_UPDATE_ANY: 'user:update:any',
  USER_DELETE_ANY: 'user:delete:any',

  // Roles
  ROLE_MANAGE: 'role:manage',
} as const;

// Type utilitaire : extrait les valeurs possibles ('user:read' | 'user:update:own' | ...)
export type Permission = (typeof Permissions)[keyof typeof Permissions];
