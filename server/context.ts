import { PrismaClient } from '@prisma/client';
import { Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import { config } from './shared/config.js';

export const prisma = new PrismaClient();

export interface Context {
  prisma: PrismaClient;
  userId?: string;
  res: Response;
}

interface ContextArg {
  req?: Request;
  res: Response;
}

export const createContext = async (contextArg: ContextArg | Request): Promise<Context> => {
  const req = (contextArg as ContextArg)?.req || (contextArg as Request);
  const res = (contextArg as ContextArg)?.res;
  const token: string = req?.cookies?.token || '';

  let userId: string | undefined;

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as { userId: string };
      userId = decoded.userId;
    } catch {
      // Invalid or expired token
    }
  }

  return { prisma, userId, res };
};
