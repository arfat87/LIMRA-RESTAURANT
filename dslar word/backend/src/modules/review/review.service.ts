import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';

export const addReview = async (
  userId: string,
  productId: string,
  data: { rating: number; comment?: string; images?: string[] }
) => {
  const product = await prisma.product.findUnique({ where: { id: productId, isActive: true } });
  if (!product) throw new ApiError(404, 'Product not found.');

  // Check if user has already reviewed this product
  const existing = await prisma.review.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) throw new ApiError(409, 'You have already reviewed this product.');

  // Optionally: check if user has purchased this product
  // const hasPurchased = await prisma.orderItem.findFirst({ where: { order: { userId }, productId } });
  // if (!hasPurchased) throw new ApiError(403, 'You can only review products you have purchased.');

  return prisma.review.create({
    data: { userId, productId, ...data },
    include: { user: { select: { name: true, avatar: true } } },
  });
};

export const getProductReviews = async (productId: string, page = 1, limit = 10) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, 'Product not found.');

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { productId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, avatar: true } } },
    }),
    prisma.review.count({ where: { productId } }),
  ]);

  const avgRating =
    total > 0
      ? (await prisma.review.aggregate({ where: { productId }, _avg: { rating: true } }))._avg.rating
      : null;

  return {
    reviews,
    avgRating: avgRating ? Math.round(avgRating * 10) / 10 : 0,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const deleteReview = async (userId: string, reviewId: string, isAdmin = false) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new ApiError(404, 'Review not found.');

  if (!isAdmin && review.userId !== userId) {
    throw new ApiError(403, 'You can only delete your own reviews.');
  }

  await prisma.review.delete({ where: { id: reviewId } });
};

export const getAllReviews = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
    }),
    prisma.review.count(),
  ]);
  return { reviews, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};
