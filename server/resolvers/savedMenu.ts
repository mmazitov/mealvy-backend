import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { SavedMenuService } from '../services/savedMenu.js';

export const savedMenuResolvers = {
	Query: {
		savedMenus: async (_parent: unknown, _args: unknown, context: Context) => {
			const userId = requireAuth(context);
			return SavedMenuService.getSavedMenus(userId, context.prisma);
		},
		savedMenu: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return SavedMenuService.getSavedMenu(args.id, userId, context.prisma);
		},
	},
	Mutation: {
		saveMenuPlan: async (
			_parent: unknown,
			args: {
				name: string;
				startDate: string;
				endDate: string;
				weekNumber: number;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			return SavedMenuService.saveMenuPlan(
				userId,
				args.name,
				args.startDate,
				args.endDate,
				args.weekNumber,
				context.prisma
			);
		},
		deleteSavedMenu: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return SavedMenuService.deleteSavedMenu(args.id, userId, context.prisma);
		},
		duplicateSavedMenu: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return SavedMenuService.duplicateSavedMenu(args.id, userId, context.prisma);
		},
	},
};
