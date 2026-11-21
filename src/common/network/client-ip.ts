export function getClientIp(req: {
  ip?: string;
  headers?: Record<string, unknown>;
}): string | undefined {
  const header = process.env.CLIENT_IP_HEADER?.trim().toLowerCase();
  const value = header ? req.headers?.[header] : undefined;
  const ip = typeof value === 'string' ? value.trim() : '';
  return ip || req.ip;
}
