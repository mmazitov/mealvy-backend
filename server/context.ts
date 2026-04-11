import { PrismaClient } from '@prisma/client';
import { Response, Request } from 'express';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  userId?: string;
  res: Response;
}

interface ContextArg {
  req?: Request;
  res?: Response;
}

export const createContext = async (contextArg?: ContextArg | Request): Promise<Context> => {
  const req = (contextArg as ContextArg)?.req || (contextArg as Request);
  const res = (contextArg as ContextArg)?.res;
  const cookies = req?.cookies ?? {};

  const token: string = cookies.token || '';

  let userId: string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecret-dev-only',
      ) as { userId: string };
      userId = decoded.userId;
    } catch (error) {
      if (
        !(error instanceof jwt.JsonWebTokenError) &&
        !(error instanceof jwt.TokenExpiredError) &&
        !(error instanceof jwt.NotBeforeError)
      ) {
        throw error;
      }
      // Invalid or expired token — userId stays undefined
    }
  }

  return { prisma, userId, res: res! };
};
