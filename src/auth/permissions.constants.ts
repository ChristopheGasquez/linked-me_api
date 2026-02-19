// Toutes les permissions de l'application
// Utilisé par le seed, les guards et les controllers
export const Permissions = {
  // Realms (niveau controller)
  REALM_ADMIN: 'realm:admin',
  REALM_USER:  'realm:user',

  // Admin — Rôles
  ADMIN_ROLE_READ:   'admin:role:read',
  ADMIN_ROLE_MANAGE: 'admin:role:manage',

  // Admin — Permissions
  ADMIN_PERMISSION_READ: 'admin:permission:read',

  // Admin — Utilisateurs
  ADMIN_USER_READ:        'admin:user:read',
  ADMIN_USER_ASSIGN_ROLE: 'admin:user:assign-role',
  ADMIN_USER_DELETE:      'admin:user:delete',

  // Admin — Maintenance
  ADMIN_CLEAN_USERS: 'admin:clean-users',

  // User
  USER_READ:       'user:read',
  USER_UPDATE_OWN: 'user:update:own',
  USER_DELETE_OWN: 'user:delete:own',
} as const;

// Type utilitaire : extrait les valeurs possibles ('realm:admin' | 'user:read' | ...)
export type Permission = (typeof Permissions)[keyof typeof Permissions];
