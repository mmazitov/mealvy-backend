import { Context } from '../context.js';
import { SavedMenuService } from '../services/savedMenu.js';
import { requireAuth } from './utils.js';

export const savedMenuResolvers = {
	SavedMenu: {
		isFavorite: async (parent: any, _args: unknown, context: Context) => {
			const userId = context.userId;
			if (!userId) return false;
			return parent.favoriteByIds?.includes(userId) ?? false;
		},
	},
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
		applyTemplateToPlanner: async (
			_parent: unknown,
			args: { savedMenuId: string; targetStartDate: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return SavedMenuService.applyTemplateToPlanner(
				userId,
				args.savedMenuId,
				args.targetStartDate,
				context.prisma
			);
		},
	},
};
