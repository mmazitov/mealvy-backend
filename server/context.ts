import { PrismaClient } from '@prisma/client';
import { Response } from 'express';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  userId?: string;
  res: Response;
}

export const createContext = async (contextArg?: any): Promise<Context> => {
  const req = contextArg?.req || contextArg;
  const res = contextArg?.res;
  const cookies = req?.cookies || {};

  const token: string = cookies.token || '';

  let userId: string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'supersecret-dev-only',
      ) as { userId: string };
      userId = decoded.userId;
    } catch {
      // Invalid or expired token — userId stays undefined
    }
  }

  return { prisma, userId, res };
};
