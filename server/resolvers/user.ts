import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { UserService } from '../services/user.js';

export const userResolvers = {
	User: {
		favoriteProducts: (parent: any) => parent.favoriteProducts ?? [],
		favoriteDishes: (parent: any) => parent.favoriteDishes ?? [],
		dishesCount: (parent: any) => parent._count?.dishes ?? 0,
		productsCount: (parent: any) => parent._count?.products ?? 0,
	},
	Query: {
		me: async (_parent: unknown, _args: unknown, context: Context) => {
			const userId = requireAuth(context);
			return UserService.getMe(userId, context.prisma);
		},
		favoriteProducts: async (
			_parent: unknown,
			_args: unknown,
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.getFavoriteProducts(userId, context.prisma);
		},
		favoriteDishes: async (
			_parent: unknown,
			_args: unknown,
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.getFavoriteDishes(userId, context.prisma);
		},
	},
	Mutation: {
		register: async (
			_parent: unknown,
			args: { email: string; password: string; name?: string },
			context: Context
		) => {
			return UserService.register(args, context.res, context.prisma);
		},

		login: async (
			_parent: unknown,
			args: { email: string; password: string },
			context: Context
		) => {
			return UserService.login(args, context.res, context.prisma);
		},

		logout: async (_parent: unknown, _args: unknown, context: Context) => {
			return UserService.logout(context.res);
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
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.updateProfile(userId, args, context.prisma);
		},

		changePassword: async (
			_parent: unknown,
			args: { currentPassword: string; newPassword: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.changePassword(
				userId,
				args.currentPassword,
				args.newPassword,
				context.prisma
			);
		},

		addToFavoritesProduct: async (
			_parent: unknown,
			args: { productId: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.addToFavoritesProduct(
				userId,
				args.productId,
				context.prisma
			);
		},

		removeFromFavoritesProduct: async (
			_parent: unknown,
			args: { productId: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.removeFromFavoritesProduct(
				userId,
				args.productId,
				context.prisma
			);
		},

		addToFavoritesDish: async (
			_parent: unknown,
			args: { dishId: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.addToFavoritesDish(userId, args.dishId, context.prisma);
		},

		removeFromFavoritesDish: async (
			_parent: unknown,
			args: { dishId: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return UserService.removeFromFavoritesDish(
				userId,
				args.dishId,
				context.prisma
			);
		},
	},
};
