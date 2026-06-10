import { Prisma } from '@prisma/client';
import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import type { CreateProductInput, UpdateProductInput, ProductQuery } from './product.schema';

/**
 * Slugify a product name
 */
const slugify = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

/**
 * Ensure slug is unique — append a counter if needed
 */
const generateUniqueSlug = async (name: string, excludeId?: string): Promise<string> => {
  let slug = slugify(name);
  let counter = 0;

  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    counter++;
  }
};

export const getProducts = async (query: ProductQuery) => {
  const { page, limit, category, condition, minPrice, maxPrice, sort, brand } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (category) {
    where.category = { slug: category };
  }
  if (condition) where.condition = condition;
  if (brand) where.brand = { contains: brand, mode: 'insensitive' };
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price.gte = minPrice;
    if (maxPrice !== undefined) where.price.lte = maxPrice;
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort === 'price_asc'
      ? { price: 'asc' }
      : sort === 'price_desc'
      ? { price: 'desc' }
      : { createdAt: 'desc' };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        category: { select: { name: true, slug: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  };
};

export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findUnique({
    where: { slug, isActive: true },
    include: {
      category: { select: { name: true, slug: true } },
      reviews: {
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, avatar: true } } },
      },
      _count: { select: { reviews: true } },
    },
  });
  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
};

export const getFeaturedProducts = async (limit = 8) => {
  return prisma.product.findMany({
    where: { isFeatured: true, isActive: true },
    take: limit,
    include: { category: { select: { name: true, slug: true } } },
    orderBy: { createdAt: 'desc' },
  });
};

export const searchProducts = async (q: string, page = 1, limit = 12) => {
  const skip = (page - 1) * limit;
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { brand: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
    ],
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      include: { category: { select: { name: true, slug: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const createProduct = async (data: CreateProductInput): Promise<typeof product> => {
  const slug = await generateUniqueSlug(data.name);
  const product = await prisma.product.create({
    data: { ...data, slug },
    include: { category: { select: { name: true, slug: true } } },
  });
  return product;
};

export const updateProduct = async (id: string, data: UpdateProductInput) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Product not found.');

  let slug = existing.slug;
  if (data.name && data.name !== existing.name) {
    slug = await generateUniqueSlug(data.name, id);
  }

  return prisma.product.update({
    where: { id },
    data: { ...data, slug },
    include: { category: { select: { name: true, slug: true } } },
  });
};

export const deleteProduct = async (id: string) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, 'Product not found.');
  // Soft delete
  await prisma.product.update({ where: { id }, data: { isActive: false } });
};

export const addProductImages = async (id: string, imageUrls: string[]) => {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new ApiError(404, 'Product not found.');

  return prisma.product.update({
    where: { id },
    data: { images: [...product.images, ...imageUrls] },
  });
};
