import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Response } from 'express';
import { GraphQLError } from 'graphql';
import { clearAuthCookies, setAuthCookies } from '../shared/cookieHelpers.js';
import {
	createTokenPair,
	revokeAllRefreshTokens,
	revokeRefreshToken,
} from '../shared/tokens.js';

interface RegisterInput {
	email: string;
	password: string;
	name?: string;
}

interface LoginInput {
	email: string;
	password: string;
}

interface UpdateProfileInput {
	name?: string;
	phone?: string;
	avatar?: string;
	diet?: string;
	allergy?: string[];
	dislike?: string[];
}

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Compared against when the user doesn't exist, so login takes the same
// time either way — otherwise response timing reveals registered emails
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer', BCRYPT_ROUNDS);

const MAX_NAME_LENGTH = 100;
const MAX_PHONE_LENGTH = 30;
const MAX_AVATAR_URL_LENGTH = 2048;
const MAX_DIET_LENGTH = 100;
const MAX_LIST_ITEMS = 50;
const MAX_LIST_ITEM_LENGTH = 100;

const badInput = (message: string): GraphQLError =>
	new GraphQLError(message, { extensions: { code: 'BAD_USER_INPUT' } });

const validateProfileInput = (input: UpdateProfileInput): void => {
	if (input.name !== undefined && input.name.length > MAX_NAME_LENGTH) {
		throw badInput(`Name must be at most ${MAX_NAME_LENGTH} characters`);
	}
	if (input.phone !== undefined && input.phone.length > MAX_PHONE_LENGTH) {
		throw badInput(`Phone must be at most ${MAX_PHONE_LENGTH} characters`);
	}
	if (input.avatar !== undefined && input.avatar !== '') {
		if (input.avatar.length > MAX_AVATAR_URL_LENGTH) {
			throw badInput('Avatar URL is too long');
		}
		// Reject javascript: and other non-web schemes — avatar ends up in <img src>
		let parsed: URL;
		try {
			parsed = new URL(input.avatar);
		} catch {
			throw badInput('Avatar must be a valid URL');
		}
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			throw badInput('Avatar URL must use http(s)');
		}
	}
	if (input.diet !== undefined && input.diet.length > MAX_DIET_LENGTH) {
		throw badInput(`Diet must be at most ${MAX_DIET_LENGTH} characters`);
	}
	for (const [field, list] of [
		['allergy', input.allergy],
		['dislike', input.dislike],
	] as const) {
		if (list === undefined) continue;
		if (list.length > MAX_LIST_ITEMS) {
			throw badInput(`${field} list must have at most ${MAX_LIST_ITEMS} items`);
		}
		if (list.some((item) => item.length > MAX_LIST_ITEM_LENGTH)) {
			throw badInput(
				`${field} items must be at most ${MAX_LIST_ITEM_LENGTH} characters`,
			);
		}
	}
};

export class UserService {
	static async getMe(userId: string, prisma: PrismaClient) {
		return prisma.user.findUnique({
			where: { id: userId },
			select: {
				id: true,
				role: true,
				email: true,
				name: true,
				avatar: true,
				phone: true,
				diet: true,
				allergy: true,
				dislike: true,
				createdAt: true,
				updatedAt: true,
				favoriteProducts: {
					select: {
						id: true,
						name: true,
						category: true,
						imageUrl: true,
						calories: true,
						fat: true,
						carbs: true,
						protein: true,
						description: true,
						createdAt: true,
						updatedAt: true,
						userId: true,
					},
					take: 50,
				},
				favoriteDishes: {
					select: {
						id: true,
						name: true,
						category: true,
						imageUrl: true,
						ingredients: true,
						instructions: true,
						prepTime: true,
						servings: true,
						calories: true,
						protein: true,
						fat: true,
						carbs: true,
						description: true,
						createdAt: true,
						updatedAt: true,
						userId: true,
					},
					take: 50,
				},
				_count: { select: { dishes: true, products: true } },
			},
		});
	}

	static async getFavoriteProducts(userId: string, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { favoriteProducts: true },
		});
		return user?.favoriteProducts ?? [];
	}

	static async getFavoriteDishes(userId: string, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { favoriteDishes: true },
		});
		return user?.favoriteDishes ?? [];
	}

	static async register(
		input: RegisterInput,
		res: Response,
		prisma: PrismaClient,
	) {
		if (!EMAIL_REGEX.test(input.email)) {
			throw new GraphQLError('Invalid email format', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		if (input.password.length < MIN_PASSWORD_LENGTH) {
			throw new GraphQLError(
				`Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
				{ extensions: { code: 'BAD_USER_INPUT' } },
			);
		}

		const existing = await prisma.user.findUnique({
			where: { email: input.email },
		});

		if (existing) {
			throw new GraphQLError('Email already in use', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const hashedPassword = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
		const user = await prisma.user.create({
			data: {
				email: input.email,
				password: hashedPassword,
				name: input.name,
			},
		});

		const { accessToken, refreshToken } = await createTokenPair(
			user.id,
			prisma,
		);
		setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	static async login(input: LoginInput, res: Response, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { email: input.email },
		});

		const valid = await bcrypt.compare(
			input.password,
			user?.password || DUMMY_PASSWORD_HASH,
		);

		if (!user?.password || !valid) {
			throw new GraphQLError('Invalid email or password', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const { accessToken, refreshToken } = await createTokenPair(
			user.id,
			prisma,
		);
		setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	static async logout(
		res: Response,
		refreshToken: string | undefined,
		prisma: PrismaClient,
	) {
		if (refreshToken) {
			await revokeRefreshToken(refreshToken, prisma);
		}
		clearAuthCookies(res);
		return true;
	}

	static async updateProfile(
		userId: string,
		input: UpdateProfileInput,
		prisma: PrismaClient,
	) {
		validateProfileInput(input);
		return prisma.user.update({
			where: { id: userId },
			data: {
				...(input.name !== undefined && { name: input.name }),
				...(input.phone !== undefined && { phone: input.phone }),
				...(input.avatar !== undefined && { avatar: input.avatar }),
				...(input.diet !== undefined && { diet: input.diet }),
				...(input.allergy !== undefined && { allergy: input.allergy }),
				...(input.dislike !== undefined && { dislike: input.dislike }),
			},
		});
	}

	static async changePassword(
		userId: string,
		currentPassword: string,
		newPassword: string,
		prisma: PrismaClient,
	) {
		if (newPassword.length < MIN_PASSWORD_LENGTH) {
			throw new GraphQLError(
				`New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
				{ extensions: { code: 'BAD_USER_INPUT' } },
			);
		}

		const user = await prisma.user.findUnique({ where: { id: userId } });

		if (!user?.password) {
			throw new GraphQLError(
				'Password change not available for OAuth accounts',
				{
					extensions: { code: 'BAD_USER_INPUT' },
				},
			);
		}

		const isValid = await bcrypt.compare(currentPassword, user.password);
		if (!isValid) {
			throw new GraphQLError('Current password is incorrect', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const hashed = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
		await prisma.user.update({
			where: { id: userId },
			data: { password: hashed },
		});

		// Force re-login on every device: a previously stolen refresh token must
		// not survive the password change
		await revokeAllRefreshTokens(userId, prisma);

		return true;
	}

	static async addToFavoritesProduct(
		userId: string,
		productId: string,
		prisma: PrismaClient,
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteProducts: { connect: { id: productId } } },
		});
	}

	static async removeFromFavoritesProduct(
		userId: string,
		productId: string,
		prisma: PrismaClient,
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteProducts: { disconnect: { id: productId } } },
		});
	}

	static async addToFavoritesDish(
		userId: string,
		dishId: string,
		prisma: PrismaClient,
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteDishes: { connect: { id: dishId } } },
		});
	}

	static async removeFromFavoritesDish(
		userId: string,
		dishId: string,
		prisma: PrismaClient,
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteDishes: { disconnect: { id: dishId } } },
		});
	}

	static async addToFavoritesMenu(
		userId: string,
		menuId: string,
		prisma: PrismaClient,
	) {
		// Saved menus are owner-private (see SavedMenuService.getSavedMenu); favoriting another
		// user's menu would expose it via `me { favoriteMenus }`, bypassing that ownership check.
		const menu = await prisma.savedMenu.findUnique({
			where: { id: menuId },
			select: { userId: true },
		});
		if (!menu) {
			throw new GraphQLError('Saved menu not found', {
				extensions: { code: 'NOT_FOUND' },
			});
		}
		if (menu.userId !== userId) {
			throw new GraphQLError('Not authorized to favorite this menu', {
				extensions: { code: 'FORBIDDEN' },
			});
		}

		return prisma.user.update({
			where: { id: userId },
			data: { favoriteMenus: { connect: { id: menuId } } },
		});
	}

	static async removeFromFavoritesMenu(
		userId: string,
		menuId: string,
		prisma: PrismaClient,
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteMenus: { disconnect: { id: menuId } } },
		});
	}
}
