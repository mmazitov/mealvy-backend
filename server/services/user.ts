import { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import {
	ACCESS_TOKEN_EXPIRY,
	REFRESH_TOKEN_EXPIRY,
	clearAuthCookies,
	setAuthCookies,
} from '../shared/cookieHelpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

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

interface AuthTokens {
	accessToken: string;
	refreshToken: string;
}

export class UserService {
	private static createTokens(userId: string): AuthTokens {
		return {
			accessToken: jwt.sign({ userId }, JWT_SECRET, {
				expiresIn: ACCESS_TOKEN_EXPIRY,
			}),
			refreshToken: jwt.sign({ userId }, JWT_SECRET, {
				expiresIn: REFRESH_TOKEN_EXPIRY,
			}),
		};
	}

	static async getMe(userId: string, prisma: PrismaClient) {
		return prisma.user.findUnique({
			where: { id: userId },
			include: {
				favoriteProducts: true,
				favoriteDishes: true,
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

	static async register(input: RegisterInput, res: Response, prisma: PrismaClient) {
		const existing = await prisma.user.findUnique({
			where: { email: input.email },
		});

		if (existing) {
			throw new GraphQLError('Email already in use', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const hashedPassword = await bcrypt.hash(input.password, 10);
		const user = await prisma.user.create({
			data: {
				email: input.email,
				password: hashedPassword,
				name: input.name,
			},
		});

		const { accessToken, refreshToken } = this.createTokens(user.id);
		setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	static async login(input: LoginInput, res: Response, prisma: PrismaClient) {
		const user = await prisma.user.findUnique({
			where: { email: input.email },
		});

		const valid =
			user?.password && (await bcrypt.compare(input.password, user.password));

		if (!user || !valid) {
			throw new GraphQLError('Invalid email or password', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const { accessToken, refreshToken } = this.createTokens(user.id);
		setAuthCookies(res, accessToken, refreshToken);

		return { user };
	}

	static logout(res: Response) {
		clearAuthCookies(res);
		return true;
	}

	static async updateProfile(
		userId: string,
		input: UpdateProfileInput,
		prisma: PrismaClient
	) {
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
		prisma: PrismaClient
	) {
		const user = await prisma.user.findUnique({ where: { id: userId } });

		if (!user?.password) {
			throw new GraphQLError('Password change not available for OAuth accounts', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const isValid = await bcrypt.compare(currentPassword, user.password);
		if (!isValid) {
			throw new GraphQLError('Current password is incorrect', {
				extensions: { code: 'BAD_USER_INPUT' },
			});
		}

		const hashed = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { id: userId },
			data: { password: hashed },
		});

		return true;
	}

	static async addToFavoritesProduct(
		userId: string,
		productId: string,
		prisma: PrismaClient
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteProducts: { connect: { id: productId } } },
		});
	}

	static async removeFromFavoritesProduct(
		userId: string,
		productId: string,
		prisma: PrismaClient
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteProducts: { disconnect: { id: productId } } },
		});
	}

	static async addToFavoritesDish(
		userId: string,
		dishId: string,
		prisma: PrismaClient
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteDishes: { connect: { id: dishId } } },
		});
	}

	static async removeFromFavoritesDish(
		userId: string,
		dishId: string,
		prisma: PrismaClient
	) {
		return prisma.user.update({
			where: { id: userId },
			data: { favoriteDishes: { disconnect: { id: dishId } } },
		});
	}
}
