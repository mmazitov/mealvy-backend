import { MealTime } from '@prisma/client';

import { Context } from '../context.js';
export const plannerResolvers = {
	Query: {
		getPlannerItems: async (
			_: any,
			{ startDate, endDate }: { startDate: string, endDate: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');
			return prisma.plannerItem.findMany({
				where: { 
					userId,
					date: {
						gte: new Date(startDate),
						lt: new Date(endDate),
					}
				},
				include: { dish: true },
			});
		},
	},

	Mutation: {
		savePlanner: async (
			_: any,
			{ items, startDate, endDate }: { items: { id?: string; dishId: string; date: string; mealTime: MealTime }[], startDate: string, endDate: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');

			const incomingIds = items.map((item) => item.id).filter(Boolean) as string[];

			// Delete existing items for the user for the specific date range that are not in incomingIds
			await prisma.plannerItem.deleteMany({
				where: { 
					userId,
					id: { notIn: incomingIds },
					date: {
						gte: new Date(startDate),
						lt: new Date(endDate),
					}
				},
			});

			// Upsert incoming items concurrently
			await Promise.all(
				items.map((item) => {
					if (item.id) {
						return prisma.plannerItem.update({
							where: { id: item.id },
							data: {
								dishId: item.dishId,
								date: new Date(item.date),
								mealTime: item.mealTime,
							},
						});
					} else {
						return prisma.plannerItem.create({
							data: {
								userId,
								dishId: item.dishId,
								date: new Date(item.date),
								mealTime: item.mealTime,
							},
						});
					}
				})
			);

			return true;
		},
	},
};
