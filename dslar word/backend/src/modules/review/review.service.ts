import { Review } from '../../models/Review.model';
import { Product } from '../../models/Product.model';
import { ApiError } from '../../utils/ApiError';

export const addReview = async (
  userId: string,
  productId: string,
  data: { rating: number; comment?: string; images?: string[] }
) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) throw new ApiError(404, 'Product not found.');

  const existing = await Review.findOne({ userId, productId });
  if (existing) throw new ApiError(409, 'You have already reviewed this product.');

  const review = await Review.create({ userId, productId, ...data });
  await review.populate('userId', 'name avatar');
  return { ...review.toObject(), id: review._id.toString() };
};

export const getProductReviews = async (productId: string, page = 1, limit = 10) => {
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');

  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    Review.find({ productId })
      .populate('userId', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Review.countDocuments({ productId }),
  ]);

  const avgResult = await Review.aggregate([
    { $match: { productId: product._id } },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ]);
  const avgRating = avgResult[0]?.avg ? Math.round(avgResult[0].avg * 10) / 10 : 0;

  return {
    reviews: reviews.map((r) => ({
      ...r,
      id: r._id.toString(),
      user: r.userId,
    })),
    avgRating,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const deleteReview = async (userId: string, reviewId: string, isAdmin = false) => {
  const review = await Review.findById(reviewId);
  if (!review) throw new ApiError(404, 'Review not found.');

  if (!isAdmin && review.userId.toString() !== userId) {
    throw new ApiError(403, 'You can only delete your own reviews.');
  }

  await review.deleteOne();
};

export const getAllReviews = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [reviews, total] = await Promise.all([
    Review.find()
      .populate('userId', 'name email')
      .populate('productId', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Review.countDocuments(),
  ]);
  return {
    reviews: reviews.map((r) => ({
      ...r,
      id: r._id.toString(),
      user: r.userId,
      product: r.productId,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};
