import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';

export const getAllCategories = async () => {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
};

export const getProductsByCategory = async (
  slug: string,
  page = 1,
  limit = 12
) => {
  const category = await prisma.category.findUnique({ where: { slug } });
  if (!category) throw new ApiError(404, 'Category not found.');

  const skip = (page - 1) * limit;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { categoryId: category.id, isActive: true },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { reviews: true } } },
    }),
    prisma.product.count({ where: { categoryId: category.id, isActive: true } }),
  ]);

  return {
    category,
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createCategory = async (data: {
  name: string;
  description?: string;
  image?: string;
}) => {
  const slug = data.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) throw new ApiError(409, 'Category with this name already exists.');

  return prisma.category.create({ data: { ...data, slug } });
};

export const updateCategory = async (
  id: string,
  data: { name?: string; description?: string; image?: string }
) => {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new ApiError(404, 'Category not found.');

  let slug = cat.slug;
  if (data.name && data.name !== cat.name) {
    slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
  }

  return prisma.category.update({ where: { id }, data: { ...data, slug } });
};

export const deleteCategory = async (id: string) => {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new ApiError(404, 'Category not found.');

  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    throw new ApiError(400, `Cannot delete category with ${productCount} active products.`);
  }

  await prisma.category.delete({ where: { id } });
};
