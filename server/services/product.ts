import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

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
			where: {
				...(filters.category && { category: filters.category }),
				...(filters.search && {
					OR: [
						{
							name: {
								contains: filters.search,
								mode: 'insensitive',
							},
						},
						{
							description: {
								contains: filters.search,
								mode: 'insensitive',
							},
						},
					],
				}),
				...(filters.userId && { userId: filters.userId }),
			},
			take: filters.limit || undefined,
			skip: filters.offset || undefined,
			orderBy: { createdAt: 'desc' },
		});
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

		const userIsAdmin = await this.isUserAdmin(userId, prisma);

		if (existingProduct.userId !== userId && !userIsAdmin) {
			throw new GraphQLError('Not authorized to update this product', {
				extensions: { code: 'FORBIDDEN' },
			});
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

		const userIsAdmin = await this.isUserAdmin(userId, prisma);

		if (existingProduct.userId !== userId && !userIsAdmin) {
			throw new GraphQLError('Not authorized to delete this product', {
				extensions: { code: 'FORBIDDEN' },
			});
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
