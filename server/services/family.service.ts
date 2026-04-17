import { GraphQLError } from 'graphql';
import { PrismaClient, InvitationStatus } from '@prisma/client';

export class FamilyService {
  static async getFamilyMembers(userId: string, prisma: PrismaClient) {
    // Get accepted family members
    const familyRelations = await prisma.familyMember.findMany({
      where: { userId },
      include: {
        member: {
          select: {
            id: true,
            email: true,
            name: true,
            _count: {
              select: { menuPlans: true },
            },
          },
        },
      },
    });

    // Get pending invitations
    const pendingInvitations = await prisma.familyInvitation.findMany({
      where: {
        inviterId: userId,
        status: InvitationStatus.PENDING,
        expiresAt: { gte: new Date() },
      },
    });

    // Get current user info
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        _count: {
          select: { menuPlans: true },
        },
      },
    });

    if (!currentUser) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    // Build response with owner (current user) + members + pending
    const members = [
      {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        status: 'OWNER',
        sharedMenusCount: currentUser._count.menuPlans,
        invitedAt: null,
      },
      ...familyRelations.map((rel) => ({
        id: rel.member.id,
        email: rel.member.email,
        name: rel.member.name,
        status: 'MEMBER',
        sharedMenusCount: rel.member._count.menuPlans,
        invitedAt: rel.createdAt.toISOString(),
      })),
      ...pendingInvitations.map((inv) => ({
        id: inv.id,
        email: inv.inviteeEmail,
        name: null,
        status: 'PENDING',
        sharedMenusCount: 0,
        invitedAt: inv.createdAt.toISOString(),
      })),
    ];

    return members;
  }

  static async inviteFamilyMember(
    userId: string,
    email: string,
    prisma: PrismaClient,
  ) {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new GraphQLError('Invalid email format', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Check if inviting self
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (currentUser?.email === email) {
      throw new GraphQLError('Cannot invite yourself', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Check if already a family member
    const inviteeUser = await prisma.user.findUnique({
      where: { email },
    });

    if (inviteeUser) {
      const existingMember = await prisma.familyMember.findUnique({
        where: {
          userId_memberId: {
            userId,
            memberId: inviteeUser.id,
          },
        },
      });

      if (existingMember) {
        throw new GraphQLError('User is already a family member', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }
    }

    // Check for existing pending invitation
    const existingInvitation = await prisma.familyInvitation.findUnique({
      where: {
        inviterId_inviteeEmail: {
          inviterId: userId,
          inviteeEmail: email,
        },
      },
    });

    if (existingInvitation && existingInvitation.status === InvitationStatus.PENDING) {
      throw new GraphQLError('Invitation already sent to this email', {
        extensions: { code: 'BAD_USER_INPUT' },
      });
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.familyInvitation.create({
      data: {
        inviterId: userId,
        inviteeEmail: email,
        expiresAt,
        status: InvitationStatus.PENDING,
      },
    });

    return {
      id: invitation.id,
      email: invitation.inviteeEmail,
      name: null,
      status: 'PENDING',
      invitedAt: invitation.createdAt.toISOString(),
    };
  }

  static async removeFamilyMember(
    userId: string,
    memberId: string,
    prisma: PrismaClient,
  ) {
    const familyMember = await prisma.familyMember.findUnique({
      where: {
        userId_memberId: {
          userId,
          memberId,
        },
      },
    });

    if (!familyMember) {
      throw new GraphQLError('Family member not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    await prisma.familyMember.delete({
      where: {
        userId_memberId: {
          userId,
          memberId,
        },
      },
    });

    return { id: memberId };
  }

  static async cancelFamilyInvitation(
    userId: string,
    invitationId: string,
    prisma: PrismaClient,
  ) {
    const invitation = await prisma.familyInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new GraphQLError('Invitation not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    if (invitation.inviterId !== userId) {
      throw new GraphQLError('Not authorized to cancel this invitation', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    await prisma.familyInvitation.delete({
      where: { id: invitationId },
    });

    return { id: invitationId };
  }
}
