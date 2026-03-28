import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

export const prisma = new PrismaClient();

export interface Context {
	prisma: PrismaClient;
	userId?: string;
}

export const createContext = async (contextArg?: any): Promise<Context> => {
	const req = contextArg?.req || contextArg;
	const headers = req?.headers || {};

	let token = '';

	if (typeof headers.get === 'function') {
		token = headers.get('authorization') || headers.get('Authorization') || '';
	} else {
		token = headers.authorization || headers['Authorization'] || '';
	}

	let userId: string | undefined;

	if (token) {
		try {
			const cleanToken = token.replace('Bearer ', '').replace('bearer ', '');
			const decoded = jwt.verify(
				cleanToken,
				process.env.JWT_SECRET || 'supersecret-dev-only',
			) as { userId: string };
			userId = decoded.userId;
		} catch (e) {
			// Invalid token
		}
	}

	return {
		prisma,
		userId,
	};
};
