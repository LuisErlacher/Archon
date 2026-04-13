import type { Context, Next } from 'hono';
import { verifyToken } from '@archon/core/auth';
import { createLogger } from '@archon/paths';

const log = createLogger('middleware.auth');

const PUBLIC_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/health',
  '/api/health/db',
  '/api/openapi.json',
]);

const PUBLIC_PREFIXES = [
  '/webhooks/',
  // SSE streaming — clients cannot set Authorization headers easily.
  // Web UI access token is still required for all other endpoints.
  // TODO: Add SSE auth via query param token in a follow-up.
  '/api/stream/',
];

export async function authMiddleware(c: Context, next: Next): Promise<void> {
  const path = new URL(c.req.url).pathname;

  if (PUBLIC_PATHS.has(path) || PUBLIC_PREFIXES.some(p => path.startsWith(p))) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    c.res = c.json({ error: 'Unauthorized' }, 401);
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token);
    c.set('userId', payload.userId);
    c.set('userRole', payload.role);
    await next();
  } catch {
    log.debug({ path }, 'auth.token_invalid');
    c.res = c.json({ error: 'Unauthorized' }, 401);
  }
}
