import { Wishlist } from '../../models/Wishlist.model';
import { Product } from '../../models/Product.model';
import { ApiError } from '../../utils/ApiError';

export const getWishlist = async (userId: string) => {
  const items = await Wishlist.find({ userId })
    .populate({
      path: 'productId',
      select: 'name slug price mrp discount images stock isActive condition',
    })
    .sort({ createdAt: -1 })
    .lean();

  return items.map((item) => ({
    ...item,
    id: item._id.toString(),
    product: item.productId,
  }));
};

export const addToWishlist = async (userId: string, productId: string) => {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found.');

  // findOneAndUpdate with upsert — idempotent
  const item = await Wishlist.findOneAndUpdate(
    { userId, productId },
    { userId, productId },
    { upsert: true, new: true }
  ).populate('productId', 'name slug');

  return { ...item!.toObject(), id: item!._id.toString() };
};

export const removeFromWishlist = async (userId: string, productId: string) => {
  const existing = await Wishlist.findOne({ userId, productId });
  if (!existing) throw new ApiError(404, 'Product not in wishlist.');
  await existing.deleteOne();
};
