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

		await Promise.all(
			items.map(async (item) => {
				if (item.id) {
					// Scope the update to the owner so a user can't overwrite another user's item by id
					const { count } = await prisma.plannerItem.updateMany({
						where: { id: item.id, userId },
						data: {
							dishId: item.dishId,
							date: new Date(item.date),
							mealTime: item.mealTime,
						},
					});
					if (count === 0) {
						throw new GraphQLError('Planner item not found', {
							extensions: { code: 'NOT_FOUND' },
						});
					}
				} else {
					await prisma.plannerItem.create({
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
	}
}
