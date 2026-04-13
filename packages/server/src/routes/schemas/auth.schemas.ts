import { z } from '@hono/zod-openapi';

export const registerBodySchema = z
  .object({
    username: z.string().min(3).max(50),
    password: z.string().min(8),
    displayName: z.string().max(100).optional(),
  })
  .strict()
  .openapi('RegisterBody');

export const loginBodySchema = z
  .object({
    username: z.string(),
    password: z.string(),
  })
  .strict()
  .openapi('LoginBody');

export const refreshBodySchema = z
  .object({
    refreshToken: z.string(),
  })
  .strict()
  .openapi('RefreshBody');

export const userSchema = z
  .object({
    id: z.string(),
    username: z.string(),
    displayName: z.string().nullable(),
    role: z.enum(['admin', 'user']),
    createdAt: z.string(),
  })
  .openapi('User');

export const authResponseSchema = z
  .object({
    user: userSchema,
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi('AuthResponse');

export const refreshResponseSchema = z
  .object({
    accessToken: z.string(),
    refreshToken: z.string(),
  })
  .openapi('RefreshResponse');

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type UserResponse = z.infer<typeof userSchema>;
