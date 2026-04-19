import { MealTime } from '@prisma/client';
import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { PlannerService } from '../services/planner.js';

export const plannerResolvers = {
	Query: {
		getPlannerItems: async (
			_parent: unknown,
			args: { startDate: string; endDate: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return PlannerService.getPlannerItems(
				userId,
				args.startDate,
				args.endDate,
				context.prisma
			);
		},
		getMenuPlans: async (
			_parent: unknown,
			args: { startDate: string; endDate: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return PlannerService.getMenuPlans(
				userId,
				args.startDate,
				args.endDate,
				context.prisma
			);
		},
	},

	Mutation: {
		savePlanner: async (
			_parent: unknown,
			args: {
				items: { id?: string; dishId: string; date: string; mealTime: MealTime }[];
				startDate: string;
				endDate: string;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			return PlannerService.savePlanner(
				userId,
				args.items,
				args.startDate,
				args.endDate,
				context.prisma
			);
		},
	},
};
