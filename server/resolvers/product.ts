import { Context } from '../context.js';
import { requireAuth } from './utils.js';
import { ProductService } from '../services/product.js';

export const productResolvers = {
	Query: {
		product: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			return ProductService.getProduct(args.id, context.prisma);
		},
		productByName: async (
			_parent: unknown,
			args: { name: string },
			context: Context
		) => {
			return ProductService.getProductByName(args.name, context.prisma);
		},
		products: async (
			_parent: unknown,
			args: {
				category?: string;
				search?: string;
				limit?: number;
				offset?: number;
				userId?: string;
			},
			context: Context
		) => {
			return ProductService.getProducts(args, context.prisma);
		},
	},
	Mutation: {
		createProduct: async (
			_parent: unknown,
			args: {
				name: string;
				category?: string;
				imageUrl?: string;
				calories?: number;
				fat?: number;
				carbs?: number;
				protein?: number;
				description?: string;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			return ProductService.createProduct(userId, args, context.prisma);
		},
		updateProduct: async (
			_parent: unknown,
			args: {
				id: string;
				name?: string;
				category?: string;
				imageUrl?: string;
				calories?: number;
				fat?: number;
				carbs?: number;
				protein?: number;
				description?: string;
			},
			context: Context
		) => {
			const userId = requireAuth(context);
			const { id, ...updateData } = args;
			return ProductService.updateProduct(id, userId, updateData, context.prisma);
		},
		deleteProduct: async (
			_parent: unknown,
			args: { id: string },
			context: Context
		) => {
			const userId = requireAuth(context);
			return ProductService.deleteProduct(args.id, userId, context.prisma);
		},
	},
	Product: {
		isFavorite: async (
			parent: { id: string },
			_args: unknown,
			context: Context
		) => {
			return context.loaders.productFavorite.load(parent.id);
		},
	},
};