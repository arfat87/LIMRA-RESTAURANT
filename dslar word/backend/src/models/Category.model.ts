import mongoose from 'mongoose';

// ============================================================
// Category Model — DSLR WORLD
// ============================================================

export interface ICategory {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new mongoose.Schema<ICategory>(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    image:       { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

categorySchema.index({ slug: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
