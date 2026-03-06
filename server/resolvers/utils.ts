import { Context } from '../context.js';

export const isAdmin = async (userId: string, prisma: Context['prisma']) => {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	return user?.role === 'ADMIN';
};

export const requireAuth = (context: Context): string => {
	if (!context.userId) {
		throw new Error('Not authenticated');
	}
	return context.userId;
};

export const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';