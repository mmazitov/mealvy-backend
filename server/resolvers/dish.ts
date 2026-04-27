import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { DishService } from '../services/dish.js';

export const dishResolvers = {
	Query: {
		dish: async (_parent: unknown, args: { id: string }, context: Context) => {
			return DishService.getDish(args.id, context.prisma);
		},
		dishByName: async (
			_parent: unknown,
			args: { name: string },
			context: Context
		) => {
			return DishService.getDishByName(args.name, context.prisma);
		},
		dishes: async (
			_parent: unknown,
			args: {
				category?: string;
				search?: string;
				limit?: number;
				offset?: number;
				userId?: string;
			},
			context: Context
		) => {
			return DishService.getDishes(args, context.prisma);
		},
	},
	Mutation: {
		createDish: async (
			_parent: unknown,
			args: {
				name: string;
				category?: string;
				imageUrl?: string;
				ingredients: Array<{ name: string; amount: string; productId?: string }>;
				instructions: string[];
				prepTime?: number;
				servings?: number;
				calories?: number;
				protein?: number;
				fat?: number;
				carbs?: number;
				description?: string;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			return DishService.createDish(userId, args, context.prisma);
		},
		updateDish: async (
			_parent: unknown,
			args: {
				id: string;
				name?: string;
				category?: string;
				imageUrl?: string;
				ingredients?: Array<{ name: string; amount: string; productId?: string }>;
				instructions?: string[];
				prepTime?: number;
				servings?: number;
				calories?: number;
				protein?: number;
				fat?: number;
				carbs?: number;
				description?: string;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			const { id, ...updateData } = args;
			return DishService.updateDish(id, userId, updateData, context.prisma);
		},
		deleteDish: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return DishService.deleteDish(args.id, userId, context.prisma);
		},
	},
	Dish: {
		isFavorite: async (
			parent: { id: string },
			_args: unknown,
			context: Context
		) => {
			return context.loaders.dishFavorite.load(parent.id);
		},
	},
	Ingredient: {
		product: async (
			parent: { productId?: string },
			_args: unknown,
			context: Context
		) => {
			if (!parent.productId) {
				return null;
			}
			return context.loaders.product.load(parent.productId);
		},
	},
};