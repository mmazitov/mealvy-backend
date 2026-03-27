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
		getMenuPlans: async (
			_: any,
			{ startDate, endDate }: { startDate: string, endDate: string },
			{ userId, prisma }: Context,
		) => {
			if (!userId) throw new Error('Not authenticated');
			return prisma.menuPlan.findMany({
				where: { 
					userId,
					date: {
						gte: new Date(startDate),
						lt: new Date(endDate),
					}
				},
				include: { 
					items: { 
						include: { dish: true } 
					} 
				},
				orderBy: { date: 'asc' }
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

			// 1. Delete existing items for the user for the specific date range that are not in incomingIds
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

			// Group incoming items by date to manage MenuPlans
			const itemsByDate: Record<string, typeof items> = {};
			items.forEach(item => {
				const d = new Date(item.date);
				// Normalize date to YYYY-MM-DD for grouping
				const dateStr = d.toISOString().split('T')[0];
				if (!itemsByDate[dateStr]) itemsByDate[dateStr] = [];
				itemsByDate[dateStr].push(item);
			});

			// 2. Process each date to ensure MenuPlan exists and items are linked
			for (const [dateStr, dateItems] of Object.entries(itemsByDate)) {
				const date = new Date(dateStr);
				
				// Find or create MenuPlan for this date
				const menuPlan = await prisma.menuPlan.upsert({
					where: {
						userId_date: {
							userId,
							date,
						}
					},
					update: {
						updatedAt: new Date()
					},
					create: {
						userId,
						date,
					}
				});

				// Upsert items for this day and link to MenuPlan
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

			// 3. Clean up empty MenuPlans (optional, but good for hygiene)
			// Small optimization: only check MenuPlans in the current range
			const plansInRange = await prisma.menuPlan.findMany({
				where: {
					userId,
					date: {
						gte: new Date(startDate),
						lt: new Date(endDate),
					}
				},
				include: { _count: { select: { items: true } } }
			});

			const emptyPlans = plansInRange.filter(p => p._count.items === 0);
			if (emptyPlans.length > 0) {
				await prisma.menuPlan.deleteMany({
					where: { id: { in: emptyPlans.map(p => p.id) } }
				});
			}

			return true;
		},
	},
};
