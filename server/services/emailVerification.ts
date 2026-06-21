import { createHash, randomBytes } from 'crypto';

import { PrismaClient } from '@prisma/client';

import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';
import { EmailService } from './email.js';

// 24h validity, single-use. Tokens are stored hashed so a DB leak can't be used
// to verify accounts.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

const hashToken = (token: string): string =>
	createHash('sha256').update(token).digest('hex');

export class EmailVerificationService {
	// Issues a fresh token (replacing any outstanding one) and emails the link.
	// Best-effort: a failed send is logged, never thrown, so it can't break the
	// surrounding flow (e.g. registration).
	static async createAndSend(
		user: { id: string; email: string | null },
		prisma: PrismaClient,
	): Promise<void> {
		if (!user.email) return;

		await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });

		const token = randomBytes(32).toString('hex');
		await prisma.emailVerificationToken.create({
			data: {
				tokenHash: hashToken(token),
				userId: user.id,
				expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
			},
		});

		const link = `${config.apiUrl}/auth/verify-email?token=${token}`;
		const result = await EmailService.sendEmailVerification(user.email, link);
		if (!result.success) {
			logger.error({ userId: user.id }, 'Failed to send verification email');
		}
	}

	// Marks the user verified and consumes the token. Returns false for
	// missing/expired tokens.
	static async verify(token: string, prisma: PrismaClient): Promise<boolean> {
		const stored = await prisma.emailVerificationToken.findUnique({
			where: { tokenHash: hashToken(token) },
		});

		if (!stored || stored.expiresAt < new Date()) {
			if (stored) {
				await prisma.emailVerificationToken
					.delete({ where: { id: stored.id } })
					.catch(() => {});
			}
			return false;
		}

		await prisma.user.update({
			where: { id: stored.userId },
			data: { emailVerified: true },
		});
		await prisma.emailVerificationToken.deleteMany({
			where: { userId: stored.userId },
		});

		return true;
	}
}
