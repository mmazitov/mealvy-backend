import { MealTime, PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { formatDateToISO } from '../shared/dateHelpers.js';

interface PlannerItemInput {
	id?: string;
	dishId: string;
	date: string;
	mealTime: MealTime;
}

export class PlannerService {
	static async getPlannerItems(
		userId: string,
		startDate: string,
		endDate: string,
		prisma: PrismaClient
	) {
		return prisma.plannerItem.findMany({
			where: {
				userId,
				date: {
					gte: new Date(startDate),
					lt: new Date(endDate),
				},
			},
			include: { dish: true },
		});
	}

	static async getMenuPlans(
		userId: string,
		startDate: string,
		endDate: string,
		prisma: PrismaClient
	) {
		return prisma.menuPlan.findMany({
			where: {
				userId,
				date: {
					gte: new Date(startDate),
					lt: new Date(endDate),
				},
			},
			include: {
				items: {
					include: { dish: true },
				},
			},
			orderBy: { date: 'asc' },
		});
	}

	static async savePlanner(
		userId: string,
		items: PlannerItemInput[],
		startDate: string,
		endDate: string,
		prisma: PrismaClient
	) {
		const incomingIds = items.map((item) => item.id).filter(Boolean) as string[];

		await prisma.plannerItem.deleteMany({
			where: {
				userId,
				id: { notIn: incomingIds },
				date: {
					gte: new Date(startDate),
					lt: new Date(endDate),
				},
			},
		});

		const itemsByDate: Record<string, PlannerItemInput[]> = {};
		items.forEach((item) => {
			const dateStr = formatDateToISO(new Date(item.date));
			if (!itemsByDate[dateStr]) itemsByDate[dateStr] = [];
			itemsByDate[dateStr].push(item);
		});

		for (const [dateStr, dateItems] of Object.entries(itemsByDate)) {
			const date = new Date(dateStr);

			const menuPlan = await prisma.menuPlan.upsert({
				where: {
					userId_date: {
						userId,
						date,
					},
				},
				update: {
					updatedAt: new Date(),
				},
				create: {
					userId,
					date,
				},
			});

			await Promise.all(
				dateItems.map((item) => {
					if (item.id) {
						return prisma.plannerItem.update({
							where: { id: item.id },
							data: {
								dishId: item.dishId,
								date: new Date(item.date),
								mealTime: item.mealTime,
								menuPlanId: menuPlan.id,
							},
						});
					} else {
						return prisma.plannerItem.create({
							data: {
								userId,
								dishId: item.dishId,
								date: new Date(item.date),
								mealTime: item.mealTime,
								menuPlanId: menuPlan.id,
							},
						});
					}
				})
			);
		}

		const plansInRange = await prisma.menuPlan.findMany({
			where: {
				userId,
				date: {
					gte: new Date(startDate),
					lt: new Date(endDate),
				},
			},
			include: { _count: { select: { items: true } } },
		});

		const emptyPlans = plansInRange.filter((p) => p._count.items === 0);
		if (emptyPlans.length > 0) {
			await prisma.menuPlan.deleteMany({
				where: { id: { in: emptyPlans.map((p) => p.id) } },
			});
		}

		return true;
	}
}
