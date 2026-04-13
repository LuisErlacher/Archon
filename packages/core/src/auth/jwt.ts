import { SignJWT, jwtVerify } from 'jose';

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is required');
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  userId: string;
  role: 'admin' | 'user';
}

async function signToken(payload: TokenPayload, expirationTime: string): Promise<string> {
  return new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(expirationTime)
    .setIssuedAt()
    .sign(getSecret());
}

export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  return signToken(payload, '1h');
}

export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  return signToken(payload, '7d');
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, getSecret());
  const userId = payload.userId;
  const role = payload.role;
  if (typeof userId !== 'string' || (role !== 'admin' && role !== 'user')) {
    throw new Error('Invalid token payload');
  }
  return { userId, role };
}
