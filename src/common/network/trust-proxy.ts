import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/**
 * Parses TRUST_PROXY into an Express "trust proxy" value.
 * - unset / "" / "false" → undefined (not set: req.ip = socket address)
 * - "1", "2"… → number of proxy hops to trust
 * - anything else → addresses / subnets / presets ("loopback", "10.0.0.0/8, …")
 * "true" is rejected: it trusts every hop, so any client could spoof its IP
 * with an X-Forwarded-For header.
 */
export function parseTrustProxy(
  raw: string | undefined,
): number | string | undefined {
  const value = raw?.trim();
  if (!value || value === 'false') return undefined;
  if (value === 'true')
    throw new Error(
      'TRUST_PROXY=true would let clients spoof their IP: use a hop count or a list of addresses',
    );
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

/** Temporary diagnostic (LOG_CLIENT_IP=true): what Express sees of the client IP. */
export function clientIpLogger(logger = new Logger('ClientIp')) {
  return (req: Request, _res: Response, next: NextFunction) => {
    logger.log(
      JSON.stringify({
        method: req.method,
        path: req.path,
        ip: req.ip,
        ips: req.ips,
        remoteAddress: req.socket.remoteAddress,
        xForwardedFor: req.headers['x-forwarded-for'] ?? null,
        xRealIp: req.headers['x-real-ip'] ?? null,
      }),
    );
    next();
  };
}
