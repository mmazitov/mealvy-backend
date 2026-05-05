import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { formatDateToISO } from '../shared/dateHelpers.js';

export interface DishSummary {
	id: string;
	name: string;
	imageUrl: string | null;
	category: string | null;
	calories: number | null;
	protein: number | null;
	fat: number | null;
	carbs: number | null;
}

export interface PlannerItemWithDish {
	dish: DishSummary;
}

export interface MenuWithItems {
	startDate: Date;
	endDate: Date;
	items: PlannerItemWithDish[];
	[key: string]: unknown;
}

export class SavedMenuService {
	static async getSavedMenus(userId: string, prisma: PrismaClient) {
		const savedMenus = await prisma.savedMenu.findMany({
			where: { userId },
			select: {
				id: true,
				name: true,
				startDate: true,
				endDate: true,
				weekNumber: true,
				createdAt: true,
				updatedAt: true,
				favoriteByIds: true,
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								category: true,
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
			select: {
				id: true,
				userId: true,
				name: true,
				startDate: true,
				endDate: true,
				weekNumber: true,
				createdAt: true,
				updatedAt: true,
				favoriteByIds: true,
				items: {
					include: {
						dish: {
							select: {
								id: true,
								name: true,
								imageUrl: true,
								category: true,
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
				extensions: { code: 'BAD_USER_INPUT' },
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
						category: true,
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

		const [savedMenu, savedItems] = await prisma.$transaction(async (tx) => {
			const menu = await tx.savedMenu.create({
				data: {
					userId,
					name,
					startDate: start,
					endDate: end,
					weekNumber,
				},
			});

			const items = await Promise.all(
				plannerItems.map((item) =>
					tx.plannerItem.update({
						where: { id: item.id },
						data: { savedMenuId: menu.id },
						include: {
							dish: {
								select: {
									id: true,
									name: true,
									imageUrl: true,
									category: true,
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

			return [menu, items] as const;
		});

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
								category: true,
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
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		if (savedMenu.userId !== userId) {
			throw new GraphQLError('Not authorized to delete this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		await prisma.$transaction([
			prisma.plannerItem.updateMany({
				where: { savedMenuId: id },
				data: { savedMenuId: null },
			}),
			prisma.savedMenu.delete({
				where: { id },
			}),
		]);

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
								category: true,
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
				extensions: { code: 'BAD_USER_INPUT' },
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
								category: true,
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

	static async applyTemplateToPlanner(
		userId: string,
		savedMenuId: string,
		targetStartDate: string,
		prisma: PrismaClient
	) {
		const savedMenu = await prisma.savedMenu.findUnique({
			where: { id: savedMenuId },
			include: {
				items: {
					include: { dish: true },
				},
			},
		});

		if (!savedMenu) {
			throw new GraphQLError('Saved menu not found', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		if (savedMenu.userId !== userId) {
			throw new GraphQLError('Not authorized to access this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		const originalStart = savedMenu.startDate;
		const targetStart = new Date(targetStartDate);
		const daysDiff = Math.floor(
			(targetStart.getTime() - originalStart.getTime()) / (1000 * 60 * 60 * 24)
		);

		const newItems = savedMenu.items.map((item) => {
			const newDate = new Date(item.date);
			newDate.setDate(newDate.getDate() + daysDiff);
			return {
				dishId: item.dishId,
				date: newDate.toISOString(),
				mealTime: item.mealTime,
			};
		});

		const endDate = new Date(targetStart);
		endDate.setDate(endDate.getDate() + 7);

		await prisma.plannerItem.deleteMany({
			where: {
				userId,
				date: {
					gte: targetStart,
					lt: endDate,
				},
			},
		});

		await Promise.all(
			newItems.map((item) =>
				prisma.plannerItem.create({
					data: {
						userId,
						dishId: item.dishId,
						date: new Date(item.date),
						mealTime: item.mealTime,
					},
				})
			)
		);

		return true;
	}

	private static computeMenuTotals(menu: MenuWithItems) {
		const totalDishes = menu.items.length;
		const totalCalories = menu.items.reduce(
			(sum, item) => sum + (item.dish.calories || 0),
			0
		);
		const totalProtein = menu.items.reduce(
			(sum, item) => sum + (item.dish.protein || 0),
			0
		);
		const totalFat = menu.items.reduce(
			(sum, item) => sum + (item.dish.fat || 0),
			0
		);
		const totalCarbs = menu.items.reduce(
			(sum, item) => sum + (item.dish.carbs || 0),
			0
		);

		return {
			...menu,
			startDate: formatDateToISO(menu.startDate),
			endDate: formatDateToISO(menu.endDate),
			totalDishes,
			totalCalories: Math.round(totalCalories),
			totalProtein: Math.round(totalProtein * 10) / 10,
			totalFat: Math.round(totalFat * 10) / 10,
			totalCarbs: Math.round(totalCarbs * 10) / 10,
		};
	}
}
