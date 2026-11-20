import type { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { clientIpLogger, parseTrustProxy } from './trust-proxy.js';

describe('parseTrustProxy()', () => {
  it.each([undefined, '', '  ', 'false'])(
    'returns undefined for %j (trust proxy not set)',
    (raw) => {
      expect(parseTrustProxy(raw)).toBeUndefined();
    },
  );

  it('returns a hop count as a number', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy(' 2 ')).toBe(2);
  });

  it('keeps addresses, subnets and presets as a string', () => {
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe(
      'loopback, 10.0.0.0/8',
    );
  });

  it('rejects "true", which would let clients spoof their IP', () => {
    expect(() => parseTrustProxy('true')).toThrow(/spoof/);
  });
});

describe('clientIpLogger()', () => {
  it('logs what Express sees of the client IP, then calls next()', () => {
    const logger = { log: vi.fn() } as unknown as Logger;
    const next = vi.fn() as NextFunction;
    const req = {
      method: 'POST',
      path: '/auth/login',
      ip: '203.0.113.7',
      ips: ['203.0.113.7'],
      socket: { remoteAddress: '10.0.0.1' },
      headers: { 'x-forwarded-for': '203.0.113.7' },
    } as unknown as Request;

    clientIpLogger(logger)(req, {} as Response, next);

    expect(JSON.parse((logger.log as any).mock.calls[0][0])).toEqual({
      method: 'POST',
      path: '/auth/login',
      ip: '203.0.113.7',
      ips: ['203.0.113.7'],
      remoteAddress: '10.0.0.1',
      xForwardedFor: '203.0.113.7',
      xRealIp: null,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('logs the X-Real-IP header when present', () => {
    const logger = { log: vi.fn() } as unknown as Logger;
    const req = {
      method: 'GET',
      path: '/',
      ip: '10.0.0.1',
      ips: [],
      socket: { remoteAddress: '10.0.0.1' },
      headers: { 'x-real-ip': '203.0.113.8' },
    } as unknown as Request;

    clientIpLogger(logger)(req, {} as Response, vi.fn());

    expect(JSON.parse((logger.log as any).mock.calls[0][0])).toMatchObject({
      xForwardedFor: null,
      xRealIp: '203.0.113.8',
    });
  });

  it('uses a "ClientIp" logger by default', () => {
    expect(typeof clientIpLogger()).toBe('function');
  });
});
