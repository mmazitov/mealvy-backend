import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';

export class SavedMenuService {
	static async getSavedMenus(userId: string, prisma: PrismaClient) {
		const savedMenus = await prisma.savedMenu.findMany({
			where: { userId },
			include: {
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
					orderBy: [{ date: 'asc' }, { mealTime: 'asc' }],
				},
			},
			orderBy: { createdAt: 'desc' },
		});

		return savedMenus.map((menu) => this.computeMenuTotals(menu));
	}

	static async getSavedMenu(id: string, userId: string, prisma: PrismaClient) {
		const savedMenu = await prisma.savedMenu.findUnique({
			where: { id },
			include: {
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
					orderBy: [{ date: 'asc' }, { mealTime: 'asc' }],
				},
			},
		});

		if (!savedMenu) {
			throw new GraphQLError('Saved menu not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}

		if (savedMenu.userId !== userId) {
			throw new GraphQLError('Not authorized to access this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		return this.computeMenuTotals(savedMenu);
	}

	static async saveMenuPlan(
		userId: string,
		name: string,
		startDate: string,
		endDate: string,
		weekNumber: number,
		prisma: PrismaClient
	) {
		const start = new Date(startDate);
		const end = new Date(endDate);

		const plannerItems = await prisma.plannerItem.findMany({
			where: {
				userId,
				date: {
					gte: start,
					lt: end,
				},
			},
			include: {
				dish: {
					select: {
						id: true,
						name: true,
						imageUrl: true,
						calories: true,
						protein: true,
						fat: true,
						carbs: true,
					},
				},
			},
		});

		if (plannerItems.length === 0) {
			throw new GraphQLError('No planner items found in the specified date range', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const savedMenu = await prisma.savedMenu.create({
			data: {
				userId,
				name,
				startDate: start,
				endDate: end,
				weekNumber,
			},
		});

		const savedItems = await Promise.all(
			plannerItems.map((item) =>
				prisma.plannerItem.create({
					data: {
						userId,
						dishId: item.dishId,
						date: item.date,
						mealTime: item.mealTime,
						savedMenuId: savedMenu.id,
					},
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
				})
			)
		);

		const menuWithItems = {
			...savedMenu,
			items: savedItems,
		};

		return this.computeMenuTotals(menuWithItems);
	}

	static async deleteSavedMenu(id: string, userId: string, prisma: PrismaClient) {
		const savedMenu = await prisma.savedMenu.findUnique({
			where: { id },
			include: {
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
				},
			},
		});

		if (!savedMenu) {
			throw new GraphQLError('Saved menu not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}

		if (savedMenu.userId !== userId) {
			throw new GraphQLError('Not authorized to delete this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		await prisma.plannerItem.deleteMany({
			where: { savedMenuId: id },
		});

		await prisma.savedMenu.delete({
			where: { id },
		});

		return this.computeMenuTotals(savedMenu);
	}

	static async duplicateSavedMenu(id: string, userId: string, prisma: PrismaClient) {
		const originalMenu = await prisma.savedMenu.findUnique({
			where: { id },
			include: {
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
				},
			},
		});

		if (!originalMenu) {
			throw new GraphQLError('Saved menu not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}

		if (originalMenu.userId !== userId) {
			throw new GraphQLError('Not authorized to duplicate this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		const duplicatedMenu = await prisma.savedMenu.create({
			data: {
				userId,
				name: `${originalMenu.name} (копія)`,
				startDate: originalMenu.startDate,
				endDate: originalMenu.endDate,
				weekNumber: originalMenu.weekNumber,
			},
		});

		const duplicatedItems = await Promise.all(
			originalMenu.items.map((item) =>
				prisma.plannerItem.create({
					data: {
						userId,
						dishId: item.dishId,
						date: item.date,
						mealTime: item.mealTime,
						savedMenuId: duplicatedMenu.id,
					},
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								calories: true,
								protein: true,
								fat: true,
								carbs: true,
							},
						},
					},
				})
			)
		);

		const menuWithItems = {
			...duplicatedMenu,
			items: duplicatedItems,
		};

		return this.computeMenuTotals(menuWithItems);
	}

	private static computeMenuTotals(menu: any) {
		const totalDishes = menu.items.length;
		const totalCalories = menu.items.reduce(
			(sum: number, item: any) => sum + (item.dish.calories || 0),
			0
		);
		const totalProtein = menu.items.reduce(
			(sum: number, item: any) => sum + (item.dish.protein || 0),
			0
		);
		const totalFat = menu.items.reduce(
			(sum: number, item: any) => sum + (item.dish.fat || 0),
			0
		);
		const totalCarbs = menu.items.reduce(
			(sum: number, item: any) => sum + (item.dish.carbs || 0),
			0
		);

		return {
			...menu,
			totalDishes,
			totalCalories: Math.round(totalCalories),
			totalProtein: Math.round(totalProtein * 10) / 10,
			totalFat: Math.round(totalFat * 10) / 10,
			totalCarbs: Math.round(totalCarbs * 10) / 10,
		};
	}
}
