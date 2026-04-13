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
  // Webhooks: authenticated via HMAC signature (not JWT)
  '/webhooks/',
  // SSE streaming: bypassed entirely — EventSource cannot send custom headers.
  // KNOWN GAP: any caller knowing a conversationId can subscribe without a token.
  // TODO: Add token-in-query-param auth for SSE in a follow-up.
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
  } catch (e) {
    const err = e as Error;
    // Misconfiguration (JWT_SECRET missing) must be visible at warn level to aid diagnosis
    if (err.message?.includes('JWT_SECRET')) {
      log.warn({ err, path }, 'auth.jwt_secret_missing');
    } else {
      log.debug({ path, errorType: err.constructor?.name }, 'auth.token_invalid');
    }
    c.res = c.json({ error: 'Unauthorized' }, 401);
  }
}
