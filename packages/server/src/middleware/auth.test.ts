import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Mock setup — must be declared before any dynamic imports of mocked modules
// ---------------------------------------------------------------------------

const mockVerifyToken = mock(async (_token: string) => ({
  userId: 'user-abc',
  role: 'user' as const,
}));

mock.module('@archon/core/auth', () => ({
  verifyToken: mockVerifyToken,
}));

mock.module('@archon/paths', () => ({
  createLogger: () => ({
    debug: mock(() => undefined),
    info: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    fatal: mock(() => undefined),
    trace: mock(() => undefined),
  }),
}));

import { Hono } from 'hono';
import { authMiddleware } from './auth';

function makeApp(): Hono {
  const app = new Hono();
  app.use('/api/*', authMiddleware);
  app.get('/api/protected', c => c.json({ ok: true }));
  app.post('/api/auth/login', c => c.json({ ok: true }));
  app.post('/api/auth/register', c => c.json({ ok: true }));
  app.post('/api/auth/refresh', c => c.json({ ok: true }));
  app.get('/api/health', c => c.json({ ok: true }));
  app.get('/api/health/db', c => c.json({ ok: true }));
  app.get('/api/openapi.json', c => c.json({ ok: true }));
  app.get('/api/stream/conv-1', c => c.json({ ok: true }));
  app.post('/webhooks/github', c => c.json({ ok: true }));
  return app;
}

describe('authMiddleware', () => {
  beforeEach(() => {
    mockVerifyToken.mockClear();
    mockVerifyToken.mockImplementation(async (_token: string) => ({
      userId: 'user-abc',
      role: 'user' as const,
    }));
  });

  test('passes /api/auth/login without a token', async () => {
    const res = await makeApp().request('/api/auth/login', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /api/auth/register without a token', async () => {
    const res = await makeApp().request('/api/auth/register', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /api/auth/refresh without a token', async () => {
    const res = await makeApp().request('/api/auth/refresh', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /api/health without a token', async () => {
    const res = await makeApp().request('/api/health');
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /api/openapi.json without a token', async () => {
    const res = await makeApp().request('/api/openapi.json');
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /api/stream/* without a token', async () => {
    const res = await makeApp().request('/api/stream/conv-1');
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('passes /webhooks/* without a token', async () => {
    const res = await makeApp().request('/webhooks/github', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(mockVerifyToken).not.toHaveBeenCalled();
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await makeApp().request('/api/protected');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 401 when Authorization header lacks Bearer prefix', async () => {
    const res = await makeApp().request('/api/protected', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 when token verification fails', async () => {
    mockVerifyToken.mockRejectedValueOnce(new Error('Token expired'));
    const res = await makeApp().request('/api/protected', {
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(401);
  });

  test('sets userId and userRole on valid token and calls next', async () => {
    let capturedUserId: string | undefined;
    let capturedRole: string | undefined;
    const app = new Hono();
    app.use('/api/*', authMiddleware);
    app.get('/api/protected', c => {
      capturedUserId = c.get('userId') as string;
      capturedRole = c.get('userRole') as string;
      return c.json({ ok: true });
    });
    const res = await app.request('/api/protected', {
      headers: { Authorization: 'Bearer valid-token' },
    });
    expect(res.status).toBe(200);
    expect(capturedUserId).toBe('user-abc');
    expect(capturedRole).toBe('user');
  });
});
