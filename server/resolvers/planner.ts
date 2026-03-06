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
			{ items, startDate, endDate }: { items: { dishId: string; date: string; mealTime: string }[], startDate: string, endDate: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');

			// Delete existing items for the user for the specific date range
			await prisma.plannerItem.deleteMany({
				where: { 
					userId,
					date: {
						gte: new Date(startDate),
						lt: new Date(endDate),
					}
				},
			});

			// Create new items concurrently
            // Ideally we could use createMany, but MongoDB on Prisma has some constraints, createMany is ok though
			if (items.length > 0) {
				const plannerItemsData = items.map((item) => ({
					userId,
					dishId: item.dishId,
					date: new Date(item.date),
					mealTime: item.mealTime,
				}));

				await prisma.plannerItem.createMany({
					data: plannerItemsData,
				});
			}

			return true;
		},
	},
};
