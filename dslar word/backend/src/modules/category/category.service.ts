import { Category } from '../../models/Category.model';
import { Product } from '../../models/Product.model';
import { ApiError } from '../../utils/ApiError';

const slugify = (name: string) =>
  name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

export const getAllCategories = async () => {
  const categories = await Category.find().sort({ name: 1 }).lean();
  // Attach product count via aggregation
  const counts = await Product.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$categoryId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return categories.map((cat) => ({
    ...cat,
    id: cat._id.toString(),
    _count: { products: countMap.get(cat._id.toString()) ?? 0 },
  }));
};

export const getProductsByCategory = async (slug: string, page = 1, limit = 12) => {
  const category = await Category.findOne({ slug });
  if (!category) throw new ApiError(404, 'Category not found.');

  const skip = (page - 1) * limit;
  const [products, total] = await Promise.all([
    Product.find({ categoryId: category._id, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Product.countDocuments({ categoryId: category._id, isActive: true }),
  ]);

  return {
    category: { ...category.toObject(), id: category._id.toString() },
    products: products.map((p) => ({ ...p, id: p._id.toString() })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createCategory = async (data: { name: string; description?: string; image?: string }) => {
  const slug = slugify(data.name);
  const existing = await Category.findOne({ slug });
  if (existing) throw new ApiError(409, 'Category with this name already exists.');

  const category = await Category.create({ ...data, slug });
  return { ...category.toObject(), id: category._id.toString() };
};

export const updateCategory = async (
  id: string,
  data: { name?: string; description?: string; image?: string }
) => {
  const cat = await Category.findById(id);
  if (!cat) throw new ApiError(404, 'Category not found.');

  let slug = cat.slug;
  if (data.name && data.name !== cat.name) {
    slug = slugify(data.name);
  }

  const updated = await Category.findByIdAndUpdate(id, { ...data, slug }, { new: true });
  return { ...updated!.toObject(), id: updated!._id.toString() };
};

export const deleteCategory = async (id: string) => {
  const cat = await Category.findById(id);
  if (!cat) throw new ApiError(404, 'Category not found.');

  const productCount = await Product.countDocuments({ categoryId: id, isActive: true });
  if (productCount > 0) {
    throw new ApiError(400, `Cannot delete category with ${productCount} active products.`);
  }

  await cat.deleteOne();
};
