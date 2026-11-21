import { getClientIp } from './client-ip.js';

describe('getClientIp()', () => {
  afterEach(() => {
    delete process.env.CLIENT_IP_HEADER;
  });

  const req = (headers: Record<string, unknown> = {}) => ({
    ip: '100.64.0.5',
    headers,
  });

  it('should use req.ip when CLIENT_IP_HEADER is unset, ignoring headers', () => {
    expect(getClientIp(req({ 'x-real-ip': '203.0.113.9' }))).toBe('100.64.0.5');
  });

  it('should use the configured header (name case-insensitive)', () => {
    process.env.CLIENT_IP_HEADER = ' X-Real-IP ';
    expect(getClientIp(req({ 'x-real-ip': ' 203.0.113.9 ' }))).toBe(
      '203.0.113.9',
    );
  });

  it('should fall back to req.ip when the header is missing or empty', () => {
    process.env.CLIENT_IP_HEADER = 'x-real-ip';
    expect(getClientIp(req())).toBe('100.64.0.5');
    expect(getClientIp(req({ 'x-real-ip': ' ' }))).toBe('100.64.0.5');
    expect(getClientIp({ ip: '100.64.0.5' })).toBe('100.64.0.5');
  });

  it('should fall back to req.ip when the header is not a string', () => {
    process.env.CLIENT_IP_HEADER = 'x-real-ip';
    expect(getClientIp(req({ 'x-real-ip': ['1.1.1.1', '2.2.2.2'] }))).toBe(
      '100.64.0.5',
    );
  });
});
