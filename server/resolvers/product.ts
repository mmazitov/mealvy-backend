import { Context } from '../context.js';
import { isAdmin, requireAuth } from './utils.js';

export const productResolvers = {
	Query: {
		product: async (
			_parent: unknown,
			args: { id: string },
			context: Context,
		) => {
			const product = await context.prisma.product.findUnique({
				where: { id: args.id },
			});

			return product;
		},
		productByName: async (
			_parent: unknown,
			args: { name: string },
			context: Context,
		) => {
			const product = await context.prisma.product.findFirst({
				where: { 
					name: {
						equals: args.name,
						mode: 'insensitive'
					}
				},
			});

			return product;
		},
		products: async (
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
			const products = await context.prisma.product.findMany({
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

			return products;
		},
	},
	Mutation: {
		createProduct: async (
			_parent: unknown,
			args: {
				name: string;
				category?: string;
				imageUrl?: string;
				calories?: number;
				fat?: number;
				carbs?: number;
				protein?: number;
				description?: string;
			},
			context: Context,
		) => {
			const userId = requireAuth(context);

			const product = await context.prisma.product.create({
				data: {
					...args,
					userId,
				},
			});

			return product;
		},
		updateProduct: async (
			_parent: unknown,
			args: {
				id: string;
				name?: string;
				category?: string;
				imageUrl?: string;
				calories?: number;
				fat?: number;
				carbs?: number;
				protein?: number;
				description?: string;
			},
			context: Context,
		) => {
			const userId = requireAuth(context);

			const existingProduct = await context.prisma.product.findUnique({
				where: { id: args.id },
			});

			if (!existingProduct) {
				throw new Error('Product not found');
			}

			const userIsAdmin = await isAdmin(userId, context.prisma);
			
			if (existingProduct.userId !== userId && !userIsAdmin) {
				throw new Error('Not authorized to update this product');
			}

			const { id, ...updateData } = args;
			const product = await context.prisma.product.update({
				where: { id },
				data: updateData,
			});

			return product;
		},
		deleteProduct: async (
			_parent: unknown,
			args: { id: string },
			context: Context,
		) => {
			const userId = requireAuth(context);

			const existingProduct = await context.prisma.product.findUnique({
				where: { id: args.id },
			});

			if (!existingProduct) {
				throw new Error('Product not found');
			}

			const userIsAdmin = await isAdmin(userId, context.prisma);
			
			if (existingProduct.userId !== userId && !userIsAdmin) {
				throw new Error('Not authorized to delete this product');
			}

			const product = await context.prisma.product.delete({
				where: { id: args.id },
			});

			return product;
		},
	},
	Product: {
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
					favoriteProducts: { where: { id: parent.id } },
				},
			});

			return user?.favoriteProducts.length! > 0;
		},
	},
};