export const ResponseCodes = {
  // ─── Throttle ─────────────────────────────────────────────
  THROTTLE_TOO_MANY_REQUESTS:             'throttle.too_many_requests',

  // ─── Validation ──────────────────────────────────────────
  VALIDATION_FAILED:                      'validation.failed',

  // ─── Auth — errors ───────────────────────────────────────
  AUTH_REGISTER_CONFLICT:               'auth.register.conflict',
  AUTH_LOGIN_INVALID_CREDENTIALS:       'auth.login.invalid_credentials',
  AUTH_LOGIN_ACCOUNT_LOCKED:            'auth.login.account_locked',
  AUTH_LOGIN_EMAIL_NOT_VERIFIED:        'auth.login.email_not_verified',
  AUTH_REFRESH_INVALID_TOKEN:           'auth.refresh.invalid_token',
  AUTH_REFRESH_TOKEN_REVOKED:           'auth.refresh.token_revoked',
  AUTH_SESSION_NOT_FOUND:               'auth.session.not_found',
  AUTH_EMAIL_INVALID_TOKEN:             'auth.email.invalid_token',
  AUTH_PASSWORD_RESET_INVALID:          'auth.password_reset.invalid_token',

  // ─── Auth — success ──────────────────────────────────────
  AUTH_LOGOUT_SUCCESS:                  'auth.logout.success',
  AUTH_SESSION_REVOKED:                 'auth.session.revoked',
  AUTH_LOGOUT_ALL_SUCCESS:              'auth.logout_all.success',
  AUTH_EMAIL_VERIFIED:                  'auth.email.verified',
  AUTH_FORGOT_PASSWORD_SENT:            'auth.forgot_password.sent',
  AUTH_PASSWORD_RESET_SUCCESS:          'auth.password_reset.success',
  AUTH_EMAIL_RESEND_SENT:               'auth.email.resend_sent',

  // ─── Profile — errors ────────────────────────────────────
  PROFILE_USER_NOT_FOUND:               'profile.user.not_found',
  PROFILE_PASSWORD_INCORRECT:           'profile.password.incorrect',

  // ─── Profile — success ───────────────────────────────────
  PROFILE_DELETED:                      'profile.deleted',
  PROFILE_PASSWORD_CHANGED:             'profile.password.changed',

  // ─── Admin Users — errors ────────────────────────────────
  ADMIN_USER_NOT_FOUND:                 'admin.user.not_found',
  ADMIN_ROLE_NOT_FOUND:                 'admin.role.not_found',
  ADMIN_USER_ROLE_ALREADY_ASSIGNED:     'admin.user.role.already_assigned',
  ADMIN_USER_ROLE_NOT_ASSIGNED:         'admin.user.role.not_assigned',
  ADMIN_USER_HAS_ROLES:                 'admin.user.has_roles',

  // ─── Admin Users — success ───────────────────────────────
  ADMIN_USER_ROLE_ASSIGNED:             'admin.user.role.assigned',
  ADMIN_USER_ROLE_REMOVED:              'admin.user.role.removed',
  ADMIN_USER_DELETED:                   'admin.user.deleted',

  // ─── Admin Roles — errors ────────────────────────────────
  ADMIN_ROLE_ALREADY_EXISTS:            'admin.role.already_exists',
  ADMIN_ROLE_HAS_USERS:                 'admin.role.has_users',
  ADMIN_PERMISSION_UNKNOWN:             'admin.permission.unknown',
  ADMIN_ROLE_PERMISSION_NOT_ASSIGNED:   'admin.role.permission.not_assigned',

  // ─── Admin Roles — success ───────────────────────────────
  ADMIN_ROLE_DELETED:                   'admin.role.deleted',
  ADMIN_ROLE_PERMISSION_REMOVED:        'admin.role.permission.removed',

  // ─── Tasks — success ─────────────────────────────────────
  TASK_CLEANUP_UNVERIFIED_USERS:        'task.cleanup.unverified_users.done',
  TASK_CLEANUP_EXPIRED_TOKENS:          'task.cleanup.expired_tokens.done',
  TASK_CLEANUP_ORPHANED_PERMISSIONS_DONE: 'task.cleanup.orphaned_permissions.done',
  TASK_CLEANUP_ORPHANED_PERMISSIONS_NONE: 'task.cleanup.orphaned_permissions.none_found',
  TASK_CLEANUP_AUDIT_LOGS:              'task.cleanup.audit_logs.done',
} as const;
