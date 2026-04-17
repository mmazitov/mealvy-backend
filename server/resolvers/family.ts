import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { FamilyService } from '../services/family.service.js';

export const familyResolvers = {
  Query: {
    familyMembers: async (_parent: unknown, _args: unknown, context: Context) => {
      const userId = requireAuth(context);
      return FamilyService.getFamilyMembers(userId, context.prisma);
    },
  },
  Mutation: {
    inviteFamilyMember: async (
      _parent: unknown,
      args: { email: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return FamilyService.inviteFamilyMember(userId, args.email, context.prisma);
    },
    removeFamilyMember: async (
      _parent: unknown,
      args: { memberId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return FamilyService.removeFamilyMember(userId, args.memberId, context.prisma);
    },
    cancelFamilyInvitation: async (
      _parent: unknown,
      args: { invitationId: string },
      context: Context,
    ) => {
      const userId = requireAuth(context);
      return FamilyService.cancelFamilyInvitation(
        userId,
        args.invitationId,
        context.prisma,
      );
    },
  },
};
