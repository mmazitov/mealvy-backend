import { GraphQLError } from 'graphql';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Context } from '../context.js';
import { JWT_SECRET, requireAuth } from './utils.js';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  clearAuthCookies,
  setAuthCookies,
} from '../shared/cookieHelpers.js';

const createTokens = (userId: string) => ({
  accessToken: jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY }),
  refreshToken: jwt.sign({ userId }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY }),
});

export const userResolvers = {
  User: {
    // Parent object includes favoriteProducts/favoriteDishes when me() query runs with include
    // This avoids N+1 queries
    favoriteProducts: (parent: any) => parent.favoriteProducts ?? [],
    favoriteDishes: (parent: any) => parent.favoriteDishes ?? [],
    dishesCount: (parent: any) => parent._count?.dishes ?? 0,
    productsCount: (parent: any) => parent._count?.products ?? 0,
  },
  Query: {
    me: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireAuth(context);
      return context.prisma.user.findUnique({
        where: { id: userId },
        include: {
          favoriteProducts: true,
          favoriteDishes: true,
          _count: { select: { dishes: true, products: true } },
        },
      });
    },
    favoriteProducts: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireAuth(context);
      const user = await context.prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteProducts: true },
      });
      return user?.favoriteProducts ?? [];
    },
    favoriteDishes: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireAuth(context);
      const user = await context.prisma.user.findUnique({
        where: { id: userId },
        select: { favoriteDishes: true },
      });
      return user?.favoriteDishes ?? [];
    },
  },
  Mutation: {
    register: async (
      _parent: unknown,
      args: { email: string; password: string; name?: string },
      context: Context,
    ) => {
      const existing = await context.prisma.user.findUnique({ where: { email: args.email } });
      if (existing) {
        throw new GraphQLError('Email already in use', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const hashedPassword = await bcrypt.hash(args.password, 10);
      const user = await context.prisma.user.create({
        data: { email: args.email, password: hashedPassword, name: args.name },
      });

      const { accessToken, refreshToken } = createTokens(user.id);
      setAuthCookies(context.res, accessToken, refreshToken);
      return { user };
    },

    login: async (
      _parent: unknown,
      args: { email: string; password: string },
      context: Context,
    ) => {
      const user = await context.prisma.user.findUnique({ where: { email: args.email } });
      const valid = user?.password && await bcrypt.compare(args.password, user.password);

      if (!user || !valid) {
        throw new GraphQLError('Invalid email or password', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const { accessToken, refreshToken } = createTokens(user.id);
      setAuthCookies(context.res, accessToken, refreshToken);
      return { user };
    },

    logout: async (_parent: unknown, _args: unknown, context: Context) => {
      clearAuthCookies(context.res);
      return true;
    },

    updateProfile: async (
      _parent: unknown,
      args: {
        name?: string;
        phone?: string;
        avatar?: string;
        diet?: string;
        allergy?: string[];
        dislike?: string[];
      },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return context.prisma.user.update({
        where: { id: userId },
        data: {
          ...(args.name !== undefined && { name: args.name }),
          ...(args.phone !== undefined && { phone: args.phone }),
          ...(args.avatar !== undefined && { avatar: args.avatar }),
          ...(args.diet !== undefined && { diet: args.diet }),
          ...(args.allergy !== undefined && { allergy: args.allergy }),
          ...(args.dislike !== undefined && { dislike: args.dislike }),
        },
      });
    },

    changePassword: async (
      _parent: unknown,
      args: { currentPassword: string; newPassword: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      const user = await context.prisma.user.findUnique({ where: { id: userId } });

      if (!user?.password) {
        throw new GraphQLError('Password change not available for OAuth accounts', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const isValid = await bcrypt.compare(args.currentPassword, user.password);
      if (!isValid) {
        throw new GraphQLError('Current password is incorrect', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      const hashed = await bcrypt.hash(args.newPassword, 10);
      await context.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
      return true;
    },

    addToFavoritesProduct: async (
      _parent: unknown,
      args: { productId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return context.prisma.user.update({
        where: { id: userId },
        data: { favoriteProducts: { connect: { id: args.productId } } },
      });
    },

    removeFromFavoritesProduct: async (
      _parent: unknown,
      args: { productId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return context.prisma.user.update({
        where: { id: userId },
        data: { favoriteProducts: { disconnect: { id: args.productId } } },
      });
    },

    addToFavoritesDish: async (
      _parent: unknown,
      args: { dishId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return context.prisma.user.update({
        where: { id: userId },
        data: { favoriteDishes: { connect: { id: args.dishId } } },
      });
    },

    removeFromFavoritesDish: async (
      _parent: unknown,
      args: { dishId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return context.prisma.user.update({
        where: { id: userId },
        data: { favoriteDishes: { disconnect: { id: args.dishId } } },
      });
    },
  },
};
