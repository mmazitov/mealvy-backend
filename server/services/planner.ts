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
	}
}
