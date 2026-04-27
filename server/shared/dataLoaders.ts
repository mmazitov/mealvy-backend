import DataLoader from 'dataloader';
import { PrismaClient, Product } from '@prisma/client';

export function createDishFavoriteLoader(userId: string | undefined, prisma: PrismaClient) {
    return new DataLoader<string, boolean>(async (dishIds) => {
        if (!userId) return dishIds.map(() => false);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                favoriteDishes: {
                    where: { id: { in: [...dishIds] } },
                    select: { id: true },
                },
            },
        });

        const favoriteSet = new Set(user?.favoriteDishes.map((d) => d.id) ?? []);
        return dishIds.map((id) => favoriteSet.has(id));
    });
}

export function createProductFavoriteLoader(userId: string | undefined, prisma: PrismaClient) {
    return new DataLoader<string, boolean>(async (productIds) => {
        if (!userId) return productIds.map(() => false);

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                favoriteProducts: {
                    where: { id: { in: [...productIds] } },
                    select: { id: true },
                },
            },
        });

        const favoriteSet = new Set(user?.favoriteProducts.map((p) => p.id) ?? []);
        return productIds.map((id) => favoriteSet.has(id));
    });
}

export function createProductLoader(prisma: PrismaClient) {
    return new DataLoader<string, Product | null>(async (productIds) => {
        const products = await prisma.product.findMany({
            where: { id: { in: [...productIds] } },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        return productIds.map((id) => productMap.get(id) ?? null);
    });
}

export interface DataLoaders {
    dishFavorite: ReturnType<typeof createDishFavoriteLoader>;
    productFavorite: ReturnType<typeof createProductFavoriteLoader>;
    product: ReturnType<typeof createProductLoader>;
}

export function createLoaders(userId: string | undefined, prisma: PrismaClient): DataLoaders {
    return {
        dishFavorite: createDishFavoriteLoader(userId, prisma),
        productFavorite: createProductFavoriteLoader(userId, prisma),
        product: createProductLoader(prisma),
    };
}
