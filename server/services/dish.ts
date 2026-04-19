import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

interface IngredientInput {
	name: string;
	amount: string;
	productId?: string;
}

interface CreateDishInput {
	name: string;
	category?: string;
	imageUrl?: string;
	ingredients: IngredientInput[];
	instructions: string[];
	prepTime?: number;
	servings?: number;
	calories?: number;
	protein?: number;
	fat?: number;
	carbs?: number;
	description?: string;
}

interface UpdateDishInput {
	name?: string;
	category?: string;
	imageUrl?: string;
	ingredients?: IngredientInput[];
	instructions?: string[];
	prepTime?: number;
	servings?: number;
	calories?: number;
	protein?: number;
	fat?: number;
	carbs?: number;
	description?: string;
}

export class DishService {
	static async getDish(id: string, prisma: PrismaClient) {
		return prisma.dish.findUnique({
			where: { id },
		});
	}

	static async getDishByName(name: string, prisma: PrismaClient) {
		return prisma.dish.findFirst({
			where: {
				name: {
					equals: name,
					mode: 'insensitive',
				},
			},
		});
	}

	static async getDishes(
		filters: {
			category?: string;
			search?: string;
			limit?: number;
			offset?: number;
			userId?: string;
		},
		prisma: PrismaClient
	) {
		return prisma.dish.findMany({
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

	static async createDish(
		userId: string,
		input: CreateDishInput,
		prisma: PrismaClient
	) {
		if (input.ingredients) {
			for (const ing of input.ingredients) {
				if (ing.productId) {
					const product = await prisma.product.findUnique({
						where: { id: ing.productId },
					});
					if (!product) {
						throw new GraphQLError(`Product with id ${ing.productId} not found`, {
							extensions: { code: 'BAD_USER_INPUT' },
						});
					}
				}
			}
		}

		return prisma.dish.create({
			data: {
				...input,
				userId,
			},
		});
	}

	static async updateDish(
		id: string,
		userId: string,
		input: UpdateDishInput,
		prisma: PrismaClient
	) {
		const existingDish = await prisma.dish.findUnique({
			where: { id },
		});

		if (!existingDish) {
			throw new GraphQLError('Dish not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}

		const userIsAdmin = await this.isUserAdmin(userId, prisma);

		if (existingDish.userId !== userId && !userIsAdmin) {
			throw new GraphQLError('Not authorized to update this dish', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		if (input.ingredients) {
			for (const ing of input.ingredients) {
				if (ing.productId) {
					const product = await prisma.product.findUnique({
						where: { id: ing.productId },
					});
					if (!product) {
						throw new GraphQLError(`Product with id ${ing.productId} not found`, {
							extensions: { code: 'BAD_USER_INPUT' },
						});
					}
				}
			}
		}

		return prisma.dish.update({
			where: { id },
			data: input,
		});
	}

	static async deleteDish(id: string, userId: string, prisma: PrismaClient) {
		const existingDish = await prisma.dish.findUnique({
			where: { id },
		});

		if (!existingDish) {
			throw new GraphQLError('Dish not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}

		const userIsAdmin = await this.isUserAdmin(userId, prisma);

		if (existingDish.userId !== userId && !userIsAdmin) {
			throw new GraphQLError('Not authorized to delete this dish', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		return prisma.dish.delete({
			where: { id },
		});
	}

	static async checkIsFavorite(
		dishId: string,
		userId: string | null,
		prisma: PrismaClient
	): Promise<boolean> {
		if (!userId) {
			return false;
		}

		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: {
				favoriteDishes: { where: { id: dishId } },
			},
		});

		return (user?.favoriteDishes.length ?? 0) > 0;
	}

	static async getIngredientProduct(productId: string, prisma: PrismaClient) {
		return prisma.product.findUnique({
			where: { id: productId },
		});
	}

	private static async isUserAdmin(userId: string, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		return user?.role === 'ADMIN';
	}
}
