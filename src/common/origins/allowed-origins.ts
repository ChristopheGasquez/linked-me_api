export type AllowedOrigins = { admin: string[]; all: string[] };

const toOrigin = (value: string): string | undefined => {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

const parseOrigins = (name: string): string[] =>
  (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      if (toOrigin(value) !== value) {
        throw new Error(
          `${name}: "${value}" is not an exact origin (scheme://host[:port])`,
        );
      }
      return value;
    });

export function getAllowedOrigins(): AllowedOrigins {
  const admin = parseOrigins('ADMIN_ORIGINS');
  if (admin.length === 0) {
    throw new Error('ADMIN_ORIGINS must list at least one origin');
  }
  if (process.env.SWAGGER_ENABLED === 'true' && process.env.APP_URL) {
    admin.push(new URL(process.env.APP_URL).origin);
  }
  const apps = parseOrigins('APP_ORIGINS');
  return {
    admin: [...new Set(admin)],
    all: [...new Set([...admin, ...apps])],
  };
}
