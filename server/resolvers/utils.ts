import { GraphQLError } from 'graphql';
import { config } from '../shared/config.js';
import { Context } from '../context.js';

export const isAdmin = async (userId: string, prisma: Context['prisma']) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user?.role === 'ADMIN';
};

export const requireAuth = (context: Context): string => {
  if (!context.userId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.userId;
};

export const JWT_SECRET = config.jwtSecret;
