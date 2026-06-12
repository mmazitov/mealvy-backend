import { createHash } from 'crypto';

import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { config } from './config.js';
import { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_MAX_AGE, REFRESH_TOKEN_EXPIRY } from './cookieHelpers.js';

interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
}

// Tokens are stored hashed so a DB leak doesn't expose usable refresh tokens
const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export const createAccessToken = (userId: string): string =>
  jwt.sign({ userId, type: 'access' } satisfies TokenPayload, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

export const createRefreshToken = async (
  userId: string,
  prisma: PrismaClient,
): Promise<string> => {
  const token = jwt.sign(
    { userId, type: 'refresh' } satisfies TokenPayload,
    config.jwtSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY },
  );

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000),
    },
  });

  return token;
};

export const createTokenPair = async (
  userId: string,
  prisma: PrismaClient,
): Promise<{ accessToken: string; refreshToken: string }> => ({
  accessToken: createAccessToken(userId),
  refreshToken: await createRefreshToken(userId, prisma),
});

export const verifyAccessToken = (token: string): string | undefined => {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as Partial<TokenPayload>;
    return payload.type === 'access' ? payload.userId : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Verifies a refresh token against both the JWT signature and the server-side
 * store. Returns the userId, or undefined for invalid/expired/revoked tokens.
 */
export const verifyRefreshToken = async (
  token: string,
  prisma: PrismaClient,
): Promise<string | undefined> => {
  let payload: Partial<TokenPayload>;
  try {
    payload = jwt.verify(token, config.jwtSecret) as Partial<TokenPayload>;
  } catch {
    return undefined;
  }

  if (payload.type !== 'refresh' || !payload.userId) return undefined;

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!stored || stored.expiresAt < new Date()) return undefined;

  return payload.userId;
};

export const revokeRefreshToken = async (
  token: string,
  prisma: PrismaClient,
): Promise<void> => {
  await prisma.refreshToken
    .delete({ where: { tokenHash: hashToken(token) } })
    .catch(() => {
      // Already revoked or never stored — nothing to do
    });
};
