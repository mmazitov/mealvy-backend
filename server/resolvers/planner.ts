import { Context } from '../context.js';
export const plannerResolvers = {
	Query: {
		getPlannerItems: async (
			_: any,
			{ weekStart }: { weekStart: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');
			return prisma.plannerItem.findMany({
				where: { userId, weekStart },
				include: { dish: true },
			});
		},
	},

	Mutation: {
		savePlanner: async (
			_: any,
			{ items, weekStart }: { items: { dishId: string; day: string; mealTime: string; weekStart: string }[], weekStart: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');

			// Delete existing items for the user for the specific week
			await prisma.plannerItem.deleteMany({
				where: { userId, weekStart },
			});

			// Create new items concurrently
            // Ideally we could use createMany, but MongoDB on Prisma has some constraints, createMany is ok though
			if (items.length > 0) {
				const plannerItemsData = items.map((item) => ({
					userId,
					dishId: item.dishId,
					day: item.day,
					mealTime: item.mealTime,
					weekStart,
				}));

				await prisma.plannerItem.createMany({
					data: plannerItemsData,
				});
			}

			return true;
		},
	},
};
