import { Product } from '../../models/Product.model';
import { Category } from '../../models/Category.model';
import { ApiError } from '../../utils/ApiError';
import type { CreateProductInput, UpdateProductInput, ProductQuery } from './product.schema';

const slugify = (name: string): string =>
  name.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

const generateUniqueSlug = async (name: string, excludeId?: string): Promise<string> => {
  let slug = slugify(name);
  let counter = 0;
  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await Product.findOne({ slug: candidate });
    if (!existing || existing._id.toString() === excludeId) return candidate;
    counter++;
  }
};

export const getProducts = async (query: ProductQuery) => {
  const { page, limit, category, condition, minPrice, maxPrice, sort, brand } = query;
  const skip = (page - 1) * limit;

  // Build filter
  const filter: Record<string, unknown> = { isActive: true };

  if (category) {
    const cat = await Category.findOne({ slug: category });
    if (cat) filter.categoryId = cat._id;
  }
  if (condition) filter.condition = condition;
  if (brand) filter.brand = { $regex: brand, $options: 'i' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) (filter.price as Record<string, number>).$gte = minPrice;
    if (maxPrice !== undefined) (filter.price as Record<string, number>).$lte = maxPrice;
  }

  const sortMap: Record<string, Record<string, number>> = {
    price_asc:  { price: 1 },
    price_desc: { price: -1 },
    popular:    { createdAt: -1 },
    newest:     { createdAt: -1 },
  };
  const sortObj = sortMap[sort || 'newest'] || { createdAt: -1 };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name slug')
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  // Normalise categoryId → category field for API parity
  const normalised = products.map((p) => ({
    ...p,
    id: p._id.toString(),
    category: p.categoryId,
    categoryId: undefined,
  }));

  return {
    products: normalised,
    pagination: {
      page, limit, total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

export const getProductBySlug = async (slug: string) => {
  const product = await Product.findOne({ slug, isActive: true })
    .populate('categoryId', 'name slug')
    .lean();
  if (!product) throw new ApiError(404, 'Product not found.');
  return { ...product, id: product._id.toString(), category: product.categoryId };
};

export const getFeaturedProducts = async (limit = 8) => {
  const products = await Product.find({ isFeatured: true, isActive: true })
    .populate('categoryId', 'name slug')
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return products.map((p) => ({ ...p, id: p._id.toString(), category: p.categoryId }));
};

export const searchProducts = async (q: string, page = 1, limit = 12) => {
  const skip = (page - 1) * limit;
  const filter = {
    isActive: true,
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { brand: { $regex: q, $options: 'i' } },
      { model: { $regex: q, $options: 'i' } },
    ],
  };

  const [products, total] = await Promise.all([
    Product.find(filter)
      .populate('categoryId', 'name slug')
      .skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products: products.map((p) => ({ ...p, id: p._id.toString(), category: p.categoryId })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createProduct = async (data: CreateProductInput) => {
  const slug = await generateUniqueSlug(data.name);
  const product = await Product.create({ ...data, slug });
  const populated = await product.populate('categoryId', 'name slug');
  return { ...populated.toObject(), id: product._id.toString(), category: populated.categoryId };
};

export const updateProduct = async (id: string, data: UpdateProductInput) => {
  const existing = await Product.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found.');

  let slug = existing.slug;
  if (data.name && data.name !== existing.name) {
    slug = await generateUniqueSlug(data.name, id);
  }

  const updated = await Product.findByIdAndUpdate(id, { ...data, slug }, { new: true })
    .populate('categoryId', 'name slug')
    .lean();
  return { ...updated, id: updated!._id.toString(), category: updated!.categoryId };
};

export const deleteProduct = async (id: string) => {
  const existing = await Product.findById(id);
  if (!existing) throw new ApiError(404, 'Product not found.');
  await Product.findByIdAndUpdate(id, { isActive: false });
};

export const addProductImages = async (id: string, imageUrls: string[]) => {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found.');
  product.images.push(...imageUrls);
  await product.save();
  return product;
};
