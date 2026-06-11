import mongoose from 'mongoose';

// ============================================================
// Product Model — DSLR WORLD
// ============================================================

export type Condition = 'NEW' | 'SECOND_HAND' | 'REFURBISHED';

export interface IProduct {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  price: number;      // selling price in paise
  mrp: number;        // max retail price in paise
  discount: number;   // percentage
  stock: number;
  images: string[];   // Cloudinary URLs
  condition: Condition;
  brand?: string;
  model?: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new mongoose.Schema<IProduct>(
  {
    name:        { type: String, required: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, required: true },
    price:       { type: Number, required: true, min: 0 },
    mrp:         { type: Number, required: true, min: 0 },
    discount:    { type: Number, default: 0 },
    stock:       { type: Number, default: 0, min: 0 },
    images:      [{ type: String }],
    condition:   { type: String, enum: ['NEW', 'SECOND_HAND', 'REFURBISHED'], default: 'NEW' },
    brand:       { type: String, trim: true },
    model:       { type: String, trim: true },
    isActive:    { type: Boolean, default: true },
    isFeatured:  { type: Boolean, default: false },
    categoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  },
  { timestamps: true }
);

// Indexes for search & filtering
productSchema.index({ slug: 1 });
productSchema.index({ isActive: 1, isFeatured: 1 });
productSchema.index({ categoryId: 1, isActive: 1 });
productSchema.index({ price: 1 });
productSchema.index({ stock: 1 });
// Text index for full-text search
productSchema.index({ name: 'text', description: 'text', brand: 'text', model: 'text' });

export const Product = mongoose.model<IProduct>('Product', productSchema);
