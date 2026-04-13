import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { OpenAPIHono } from '@hono/zod-openapi';

// ---------------------------------------------------------------------------
// Mock setup — must be declared before any dynamic imports of mocked modules
// ---------------------------------------------------------------------------

const mockCountUsers = mock(async () => 0);
const mockGetUserByUsername = mock(
  async (_u: string) =>
    null as null | {
      id: string;
      username: string;
      password_hash: string;
      display_name: null;
      role: 'admin' | 'user';
      created_at: string;
      updated_at: string;
    }
);
const mockCreateUser = mock(
  async (data: {
    username: string;
    password_hash: string;
    display_name?: string;
    role?: 'admin' | 'user';
  }) => ({
    id: 'user-uuid-1',
    username: data.username,
    password_hash: data.password_hash,
    display_name: data.display_name ?? null,
    role: data.role ?? 'user',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })
);
const mockGetUserById = mock(
  async (_id: string) =>
    null as null | {
      id: string;
      username: string;
      password_hash: string;
      display_name: null;
      role: 'admin' | 'user';
      created_at: string;
      updated_at: string;
    }
);

mock.module('@archon/core/db/users', () => ({
  countUsers: mockCountUsers,
  getUserByUsername: mockGetUserByUsername,
  createUser: mockCreateUser,
  getUserById: mockGetUserById,
}));

mock.module('@archon/core/auth', () => ({
  hashPassword: mock(async (p: string) => `hashed:${p}`),
  verifyPassword: mock(async (plain: string, hash: string) => hash === `hashed:${plain}`),
  generateAccessToken: mock(async () => 'access-token-123'),
  generateRefreshToken: mock(async () => 'refresh-token-456'),
  verifyToken: mock(async () => ({ userId: 'user-uuid-1', role: 'user' as const })),
}));

mock.module('@archon/paths', () => ({
  createLogger: () => ({
    info: mock(() => undefined),
    error: mock(() => undefined),
    warn: mock(() => undefined),
    debug: mock(() => undefined),
    fatal: mock(() => undefined),
    trace: mock(() => undefined),
  }),
}));

import { registerAuthRoutes } from './auth';
import { validationErrorHook } from './openapi-defaults';

function makeApp(): OpenAPIHono {
  const app = new OpenAPIHono({ defaultHook: validationErrorHook });
  registerAuthRoutes(app);
  return app;
}

// ---------------------------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    mockCountUsers.mockClear();
    mockGetUserByUsername.mockClear();
    mockCreateUser.mockClear();
  });

  test('first user receives admin role', async () => {
    mockCountUsers.mockResolvedValueOnce(0);
    mockGetUserByUsername.mockResolvedValueOnce(null);

    const res = await makeApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { user: { role: string } };
    expect(body.user.role).toBe('admin');
    const createArg = mockCreateUser.mock.calls[0]?.[0] as { role?: string };
    expect(createArg.role).toBe('admin');
  });

  test('second user receives user role', async () => {
    mockCountUsers.mockResolvedValueOnce(1);
    mockGetUserByUsername.mockResolvedValueOnce(null);

    const res = await makeApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'bob', password: 'password456' }),
    });

    expect(res.status).toBe(201);
    const createArg = mockCreateUser.mock.calls[0]?.[0] as { role?: string };
    expect(createArg.role).toBe('user');
  });

  test('returns 409 when username is already taken', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({
      id: 'existing',
      username: 'alice',
      password_hash: 'h',
      display_name: null,
      role: 'admin' as const,
      created_at: '',
      updated_at: '',
    });

    const res = await makeApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    });

    expect(res.status).toBe(409);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  test('rejects passwords shorter than 8 characters', async () => {
    const res = await makeApp().request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mockGetUserByUsername.mockClear();
  });

  test('returns tokens on valid credentials', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({
      id: 'user-uuid-1',
      username: 'alice',
      password_hash: 'hashed:password123',
      display_name: null,
      role: 'admin' as const,
      created_at: '',
      updated_at: '',
    });

    const res = await makeApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'password123' }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string; refreshToken: string };
    expect(body.accessToken).toBe('access-token-123');
    expect(body.refreshToken).toBe('refresh-token-456');
  });

  test('returns 401 when user does not exist', async () => {
    mockGetUserByUsername.mockResolvedValueOnce(null);
    const res = await makeApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'nobody', password: 'password123' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 when password is wrong', async () => {
    mockGetUserByUsername.mockResolvedValueOnce({
      id: 'user-uuid-1',
      username: 'alice',
      password_hash: 'hashed:correct',
      display_name: null,
      role: 'admin' as const,
      created_at: '',
      updated_at: '',
    });
    const res = await makeApp().request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'alice', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    mockGetUserById.mockClear();
  });

  test('returns new tokens for a valid refresh token', async () => {
    mockGetUserById.mockResolvedValueOnce({
      id: 'user-uuid-1',
      username: 'alice',
      password_hash: 'h',
      display_name: null,
      role: 'user' as const,
      created_at: '',
      updated_at: '',
    });
    const res = await makeApp().request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { accessToken: string };
    expect(body.accessToken).toBeTruthy();
  });

  test('returns 401 when user no longer exists in DB', async () => {
    mockGetUserById.mockResolvedValueOnce(null);
    const res = await makeApp().request('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'valid-refresh-token' }),
    });
    expect(res.status).toBe(401);
  });
});
