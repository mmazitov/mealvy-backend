import { GraphQLError } from 'graphql';
import { Context } from '../context.js';

export const requireAuth = (context: Context): string => {
  if (!context.userId) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.userId;
};
