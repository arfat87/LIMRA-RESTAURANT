import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';

export const getWishlist = async (userId: string) => {
  return prisma.wishlist.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          mrp: true,
          discount: true,
          images: true,
          stock: true,
          isActive: true,
          condition: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const addToWishlist = async (userId: string, productId: string) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found.');

  // Upsert — silently succeeds if already in wishlist
  return prisma.wishlist.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
    include: { product: { select: { name: true, slug: true } } },
  });
};

export const removeFromWishlist = async (userId: string, productId: string) => {
  const existing = await prisma.wishlist.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (!existing) throw new ApiError(404, 'Product not in wishlist.');

  await prisma.wishlist.delete({
    where: { userId_productId: { userId, productId } },
  });
};
