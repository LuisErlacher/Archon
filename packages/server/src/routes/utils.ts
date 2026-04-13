import type { Context } from 'hono';
import type { z } from '@hono/zod-openapi';

/** Access Zod-validated body from a handler registered via app.openapi(). */
export function getValidatedBody<T>(c: Context, _schema?: z.ZodType<T>): T {
  return (c.req as unknown as { valid(k: 'json'): T }).valid('json');
}
