import { Context } from '../context.js';
import { isAdmin, requireAuth } from './utils.js';

export const dishResolvers = {
	Query: {
		dish: async (_parent: unknown, args: { id: string }, context: Context) => {
			const dish = await context.prisma.dish.findUnique({
				where: { id: args.id },
			});

			return dish;
		},
		dishByName: async (
			_parent: unknown, 
			args: { name: string }, 
			context: Context
		) => {
			const dish = await context.prisma.dish.findFirst({
				where: { 
					name: {
						equals: args.name,
						mode: 'insensitive'
					}
				},
			});

			return dish;
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
			context: Context,
		) => {
			const dishes = await context.prisma.dish.findMany({
				where: {
					...(args.category && { category: args.category }),
					...(args.search && {
						OR: [
							{
								name: {
									contains: args.search,
									mode: 'insensitive',
								},
							},
							{
								description: {
									contains: args.search,
									mode: 'insensitive',
								},
							},
						],
					}),
					...(args.userId && { userId: args.userId }),
				},
				take: args.limit || undefined,
				skip: args.offset || undefined,
				orderBy: { createdAt: 'desc' },
			});

			return dishes;
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
			context: Context,
		) => {
			const userId = requireAuth(context);

			const dish = await context.prisma.dish.create({
				data: {
					...args,
					userId,
				},
			});

			return dish;
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
			context: Context,
		) => {
			const userId = requireAuth(context);

			// Check if user owns the dish or is admin
			const existingDish = await context.prisma.dish.findUnique({
				where: { id: args.id },
			});

			if (!existingDish) {
				throw new Error('Dish not found');
			}

			const userIsAdmin = await isAdmin(userId, context.prisma);
			
			if (existingDish.userId !== userId && !userIsAdmin) {
				throw new Error('Not authorized to update this dish');
			}

			const { id, ...updateData } = args;
			const dish = await context.prisma.dish.update({
				where: { id },
				data: updateData,
			});

			return dish;
		},
		deleteDish: async (
			_parent: unknown,
			args: { id: string },
			context: Context,
		) => {
			const userId = requireAuth(context);

			// Check if user owns the dish or is admin
			const existingDish = await context.prisma.dish.findUnique({
				where: { id: args.id },
			});

			if (!existingDish) {
				throw new Error('Dish not found');
			}

			const userIsAdmin = await isAdmin(userId, context.prisma);
			
			if (existingDish.userId !== userId && !userIsAdmin) {
				throw new Error('Not authorized to delete this dish');
			}

			const dish = await context.prisma.dish.delete({
				where: { id: args.id },
			});

			return dish;
		},
	},
	Dish: {
		isFavorite: async (
			parent: { id: string },
			_args: unknown,
			context: Context,
		) => {
			if (!context.userId) {
				return false;
			}

			const user = await context.prisma.user.findUnique({
				where: { id: context.userId },
				include: {
					favoriteDishes: { where: { id: parent.id } },
				},
			});

			return user?.favoriteDishes.length! > 0;
		},
	},
};