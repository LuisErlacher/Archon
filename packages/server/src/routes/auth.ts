import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import type { Context } from 'hono';
import * as usersDb from '@archon/core/db/users';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from '@archon/core/auth';
import type { User } from '@archon/core';
import { createLogger } from '@archon/paths';
import { errorSchema } from './schemas/common.schemas';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  authResponseSchema,
  refreshResponseSchema,
  userSchema,
} from './schemas/auth.schemas';

let cachedLog: ReturnType<typeof createLogger> | undefined;
function getLog(): ReturnType<typeof createLogger> {
  if (!cachedLog) cachedLog = createLogger('api.auth');
  return cachedLog;
}

function jsonError(description: string): {
  content: { 'application/json': { schema: typeof errorSchema } };
  description: string;
} {
  return { content: { 'application/json': { schema: errorSchema } }, description };
}

function sanitizeUser(user: User): {
  id: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'user';
  createdAt: string;
} {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
    createdAt: user.created_at,
  };
}

// Route definitions
const registerRoute = createRoute({
  method: 'post',
  path: '/api/auth/register',
  tags: ['Auth'],
  summary: 'Register a new user',
  request: {
    body: { content: { 'application/json': { schema: registerBodySchema } }, required: true },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'User created',
    },
    409: jsonError('Username already taken'),
    500: jsonError('Server error'),
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/api/auth/login',
  tags: ['Auth'],
  summary: 'Login with username and password',
  request: {
    body: { content: { 'application/json': { schema: loginBodySchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: authResponseSchema } },
      description: 'OK',
    },
    401: jsonError('Invalid credentials'),
    500: jsonError('Server error'),
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/api/auth/refresh',
  tags: ['Auth'],
  summary: 'Refresh access token',
  request: {
    body: { content: { 'application/json': { schema: refreshBodySchema } }, required: true },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: refreshResponseSchema } },
      description: 'OK',
    },
    401: jsonError('Invalid refresh token'),
    500: jsonError('Server error'),
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/api/auth/me',
  tags: ['Auth'],
  summary: 'Get current user info',
  responses: {
    200: {
      content: { 'application/json': { schema: userSchema } },
      description: 'OK',
    },
    401: jsonError('Unauthorized'),
    500: jsonError('Server error'),
  },
});

export function registerAuthRoutes(app: OpenAPIHono): void {
  function registerOpenApiRoute(
    route: ReturnType<typeof createRoute>,
    handler: (c: Context) => Response | Promise<Response>
  ): void {
    app.openapi(route, handler as never);
  }

  // POST /api/auth/register
  registerOpenApiRoute(registerRoute, async (c: Context) => {
    try {
      const body = (
        c.req as unknown as {
          valid(k: 'json'): { username: string; password: string; displayName?: string };
        }
      ).valid('json');

      const existing = await usersDb.getUserByUsername(body.username);
      if (existing) {
        return c.json({ error: 'Username already taken' }, 409);
      }

      const userCount = await usersDb.countUsers();
      const role = userCount === 0 ? 'admin' : 'user';

      const passwordHash = await hashPassword(body.password);
      const user = await usersDb.createUser({
        username: body.username,
        password_hash: passwordHash,
        display_name: body.displayName,
        role,
      });

      const tokenPayload = { userId: user.id, role: user.role };
      const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(tokenPayload),
        generateRefreshToken(tokenPayload),
      ]);

      getLog().info({ userId: user.id, role }, 'auth.register_completed');
      return c.json({ user: sanitizeUser(user), accessToken, refreshToken }, 201);
    } catch (error) {
      getLog().error({ err: error }, 'auth.register_failed');
      return c.json({ error: 'Registration failed' }, 500);
    }
  });

  // POST /api/auth/login
  registerOpenApiRoute(loginRoute, async (c: Context) => {
    try {
      const body = (
        c.req as unknown as { valid(k: 'json'): { username: string; password: string } }
      ).valid('json');

      getLog().info({ username: body.username }, 'auth.login_started');

      const user = await usersDb.getUserByUsername(body.username);
      if (!user) {
        return c.json({ error: 'Invalid username or password' }, 401);
      }

      const valid = await verifyPassword(body.password, user.password_hash);
      if (!valid) {
        return c.json({ error: 'Invalid username or password' }, 401);
      }

      const tokenPayload = { userId: user.id, role: user.role };
      const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(tokenPayload),
        generateRefreshToken(tokenPayload),
      ]);

      getLog().info({ userId: user.id }, 'auth.login_completed');
      return c.json({ user: sanitizeUser(user), accessToken, refreshToken });
    } catch (error) {
      getLog().error({ err: error }, 'auth.login_failed');
      return c.json({ error: 'Login failed' }, 500);
    }
  });

  // POST /api/auth/refresh
  registerOpenApiRoute(refreshRoute, async (c: Context) => {
    try {
      const body = (c.req as unknown as { valid(k: 'json'): { refreshToken: string } }).valid(
        'json'
      );

      let payload;
      try {
        payload = await verifyToken(body.refreshToken);
      } catch {
        return c.json({ error: 'Invalid refresh token' }, 401);
      }

      const user = await usersDb.getUserById(payload.userId);
      if (!user) {
        return c.json({ error: 'Invalid refresh token' }, 401);
      }

      const tokenPayload = { userId: user.id, role: user.role };
      const [accessToken, refreshToken] = await Promise.all([
        generateAccessToken(tokenPayload),
        generateRefreshToken(tokenPayload),
      ]);

      return c.json({ accessToken, refreshToken });
    } catch (error) {
      getLog().error({ err: error }, 'auth.refresh_failed');
      return c.json({ error: 'Token refresh failed' }, 500);
    }
  });

  // GET /api/auth/me
  registerOpenApiRoute(meRoute, async (c: Context) => {
    try {
      const userId = c.get('userId') as string | undefined;
      if (!userId) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      const user = await usersDb.getUserById(userId);
      if (!user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      return c.json(sanitizeUser(user));
    } catch (error) {
      getLog().error({ err: error }, 'auth.me_failed');
      return c.json({ error: 'Failed to get user info' }, 500);
    }
  });
}
