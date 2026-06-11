import mongoose from 'mongoose';

// ============================================================
// Wishlist Model — DSLR WORLD
// ============================================================

export interface IWishlist {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const wishlistSchema = new mongoose.Schema<IWishlist>(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One entry per user per product
wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });
wishlistSchema.index({ userId: 1 });

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
