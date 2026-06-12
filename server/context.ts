import { PrismaClient } from '@prisma/client';
import { Response, Request } from 'express';
import { DataLoaders, createLoaders } from './shared/dataLoaders.js';
import { verifyAccessToken } from './shared/tokens.js';

export const prisma = new PrismaClient();

export interface Context {
    prisma: PrismaClient;
    userId?: string;
    res: Response;
    refreshToken?: string;
    loaders: DataLoaders;
}

interface ContextArg {
    req?: Request;
    res: Response;
}

export const createContext = async (contextArg: ContextArg | Request): Promise<Context> => {
    const req = (contextArg as ContextArg)?.req || (contextArg as Request);
    const res = (contextArg as ContextArg)?.res;
    const token: string = req?.cookies?.token || '';
    const refreshToken: string | undefined = req?.cookies?.refreshToken;

    const userId = token ? verifyAccessToken(token) : undefined;

    return { prisma, userId, res, refreshToken, loaders: createLoaders(userId, prisma) };
};
