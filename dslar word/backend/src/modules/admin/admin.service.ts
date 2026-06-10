import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import * as ProductService from '../product/product.service';
import * as CategoryService from '../category/category.service';
import * as OrderService from '../order/order.service';
import * as ReviewService from '../review/review.service';
import { uploadToCloudinary } from '../../config/cloudinary';
import type { CreateProductInput, UpdateProductInput } from '../product/product.schema';
import type { UpdateOrderStatusInput } from '../order/order.schema';

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const getDashboardStats = async () => {
  const [
    totalUsers,
    totalProducts,
    totalOrders,
    pendingOrders,
    totalRevenue,
    recentOrders,
    lowStockProducts,
    totalReviews,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'CUSTOMER' } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
    }),
    prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true } },
        items: true,
      },
    }),
    prisma.product.findMany({
      where: { stock: { lte: 5 }, isActive: true },
      select: { id: true, name: true, stock: true, slug: true },
      orderBy: { stock: 'asc' },
      take: 10,
    }),
    prisma.review.count(),
  ]);

  return {
    users: { total: totalUsers },
    products: { total: totalProducts },
    orders: { total: totalOrders, pending: pendingOrders },
    revenue: { total: totalRevenue._sum.totalAmount || 0 },
    reviews: { total: totalReviews },
    recentOrders,
    lowStockProducts,
  };
};

// ─── User Management ──────────────────────────────────────────────────────────

export const getAllUsers = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    }),
    prisma.user.count(),
  ]);
  return { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const deleteUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role === 'ADMIN') throw new ApiError(403, 'Cannot delete an admin user.');
  await prisma.user.delete({ where: { id: userId } });
};

// ─── Product Management ───────────────────────────────────────────────────────

export const createProduct = (data: CreateProductInput) => ProductService.createProduct(data);
export const updateProduct = (id: string, data: UpdateProductInput) =>
  ProductService.updateProduct(id, data);
export const deleteProduct = (id: string) => ProductService.deleteProduct(id);

export const uploadProductImages = async (id: string, files: Express.Multer.File[]) => {
  const uploadPromises = files.map((file) =>
    uploadToCloudinary(file.buffer, 'dslrworld/products')
  );
  const results = await Promise.all(uploadPromises);
  const imageUrls = results.map((r) => r.secure_url);
  return ProductService.addProductImages(id, imageUrls);
};

// ─── Category Management ──────────────────────────────────────────────────────

export const createCategory = (data: { name: string; description?: string }) =>
  CategoryService.createCategory(data);

export const updateCategory = (id: string, data: { name?: string; description?: string }) =>
  CategoryService.updateCategory(id, data);

export const deleteCategory = (id: string) => CategoryService.deleteCategory(id);

// ─── Order Management ─────────────────────────────────────────────────────────

export const getAllOrders = (page: number, limit: number) =>
  OrderService.getAllOrders(page, limit);

export const updateOrderStatus = (orderId: string, data: UpdateOrderStatusInput) =>
  OrderService.updateOrderStatus(orderId, data);

// ─── Review Management ────────────────────────────────────────────────────────

export const getAllReviews = (page: number, limit: number) =>
  ReviewService.getAllReviews(page, limit);

export const deleteReview = (reviewId: string) =>
  ReviewService.deleteReview('', reviewId, true);
