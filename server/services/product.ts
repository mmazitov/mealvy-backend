import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

const MAX_QUERY_LIMIT = 200;

interface CreateProductInput {
	name: string;
	category?: string;
	imageUrl?: string;
	calories?: number;
	fat?: number;
	carbs?: number;
	protein?: number;
	description?: string;
}

interface UpdateProductInput {
	name?: string;
	category?: string;
	imageUrl?: string;
	calories?: number;
	fat?: number;
	carbs?: number;
	protein?: number;
	description?: string;
}

export class ProductService {
	static async getProduct(id: string, prisma: PrismaClient) {
		return prisma.product.findUnique({
			where: { id },
		});
	}

	static async getProductByName(name: string, prisma: PrismaClient) {
		return prisma.product.findFirst({
			where: {
				name: {
					equals: name,
					mode: 'insensitive',
				},
			},
		});
	}

	static async getProducts(
		filters: {
			category?: string;
			search?: string;
			limit?: number;
			offset?: number;
			userId?: string;
		},
		prisma: PrismaClient
	) {
		return prisma.product.findMany({
			where: this.buildWhere(filters),
			// Unbounded reads are a DoS vector — cap even when no limit is passed
			take: Math.min(filters.limit || MAX_QUERY_LIMIT, MAX_QUERY_LIMIT),
			skip: filters.offset || undefined,
			// `id` tiebreaker makes the sort a total order — without it, products
			// sharing a `createdAt` reorder between offset windows and surface on
			// more than one page.
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
		});
	}

	static async getProductsCount(
		filters: { category?: string; search?: string; userId?: string },
		prisma: PrismaClient
	) {
		return prisma.product.count({ where: this.buildWhere(filters) });
	}

	private static buildWhere(filters: {
		category?: string;
		search?: string;
		userId?: string;
	}) {
		return {
			...(filters.category && { category: filters.category }),
			...(filters.search && {
				OR: [
					{
						name: {
							contains: filters.search,
							mode: 'insensitive' as const,
						},
					},
					{
						description: {
							contains: filters.search,
							mode: 'insensitive' as const,
						},
					},
				],
			}),
			...(filters.userId && { userId: filters.userId }),
		};
	}

	static async createProduct(
		userId: string,
		input: CreateProductInput,
		prisma: PrismaClient
	) {
		return prisma.product.create({
			data: {
				...input,
				userId,
			},
		});
	}

	static async updateProduct(
		id: string,
		userId: string,
		input: UpdateProductInput,
		prisma: PrismaClient
	) {
		const existingProduct = await prisma.product.findUnique({
			where: { id },
		});

		if (!existingProduct) {
			throw new GraphQLError('Product not found', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		if (existingProduct.userId !== userId) {
			const userIsAdmin = await this.isUserAdmin(userId, prisma);
			if (!userIsAdmin) {
				throw new GraphQLError('Not authorized to update this product', {
					extensions: { code: 'FORBIDDEN' },
				});
			}
		}

		return prisma.product.update({
			where: { id },
			data: input,
		});
	}

	static async deleteProduct(id: string, userId: string, prisma: PrismaClient) {
		const existingProduct = await prisma.product.findUnique({
			where: { id },
		});

		if (!existingProduct) {
			throw new GraphQLError('Product not found', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		if (existingProduct.userId !== userId) {
			const userIsAdmin = await this.isUserAdmin(userId, prisma);
			if (!userIsAdmin) {
				throw new GraphQLError('Not authorized to delete this product', {
					extensions: { code: 'FORBIDDEN' },
				});
			}
		}

		return prisma.product.delete({
			where: { id },
		});
	}

	static async checkIsFavorite(
		productId: string,
		userId: string | null,
		prisma: PrismaClient
	): Promise<boolean> {
		if (!userId) {
			return false;
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: {
				favoriteProducts: { where: { id: productId } },
			},
		});

		return (user?.favoriteProducts.length ?? 0) > 0;
	}

	private static async isUserAdmin(userId: string, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		return user?.role === 'ADMIN';
	}
}
