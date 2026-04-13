import { describe, test, expect, beforeEach, afterEach } from 'bun:test';

const ORIGINAL_SECRET = process.env.JWT_SECRET;

describe('jwt', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
  });

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = ORIGINAL_SECRET;
    }
  });

  test('generateAccessToken returns a verifiable JWT with correct payload', async () => {
    const { generateAccessToken, verifyToken } = await import('./jwt');
    const payload = { userId: 'user-123', role: 'admin' as const };
    const token = await generateAccessToken(payload);
    const decoded = await verifyToken(token);
    expect(decoded.userId).toBe('user-123');
    expect(decoded.role).toBe('admin');
  });

  test('generateRefreshToken returns a verifiable JWT with correct payload', async () => {
    const { generateRefreshToken, verifyToken } = await import('./jwt');
    const payload = { userId: 'user-456', role: 'user' as const };
    const token = await generateRefreshToken(payload);
    const decoded = await verifyToken(token);
    expect(decoded.userId).toBe('user-456');
    expect(decoded.role).toBe('user');
  });

  test('verifyToken throws on tampered signature', async () => {
    const { generateAccessToken, verifyToken } = await import('./jwt');
    const token = await generateAccessToken({ userId: 'u1', role: 'user' });
    const tampered = token.slice(0, -5) + 'XXXXX';
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  test('verifyToken throws on missing role claim', async () => {
    const { verifyToken } = await import('./jwt');
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const noRole = await new SignJWT({ userId: 'u1' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);
    await expect(verifyToken(noRole)).rejects.toThrow('Invalid token payload');
  });

  test('verifyToken throws on invalid role value', async () => {
    const { verifyToken } = await import('./jwt');
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const badRole = await new SignJWT({ userId: 'u1', role: 'superadmin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);
    await expect(verifyToken(badRole)).rejects.toThrow('Invalid token payload');
  });

  test('generateAccessToken throws when JWT_SECRET is not set', async () => {
    delete process.env.JWT_SECRET;
    const { generateAccessToken } = await import('./jwt');
    await expect(generateAccessToken({ userId: 'u', role: 'user' })).rejects.toThrow(
      'JWT_SECRET environment variable is required'
    );
  });

  test('verifyToken throws on expired token', async () => {
    const { verifyToken } = await import('./jwt');
    const { SignJWT } = await import('jose');
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    // Use 1 second expiry and manually create expired JWT
    const expired = await new SignJWT({ userId: 'u1', role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10) // 10 seconds in the past
      .sign(secret);
    await expect(verifyToken(expired)).rejects.toThrow();
  });
});
