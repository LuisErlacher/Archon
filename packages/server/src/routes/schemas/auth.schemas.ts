import { z } from '@hono/zod-openapi';

export const loginBodySchema = z.object({
  password: z.string().min(1),
});

export const loginResponseSchema = z.object({
  token: z.string(),
});

export const authStatusResponseSchema = z.object({
  enabled: z.boolean(),
});
