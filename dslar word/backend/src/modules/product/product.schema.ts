import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'Product name must be at least 3 characters'),
    description: z.string().min(10, 'Description too short'),
    price: z.number().positive('Price must be positive'),
    mrp: z.number().positive('MRP must be positive'),
    discount: z.number().min(0).max(100).optional().default(0),
    stock: z.number().int().min(0).optional().default(0),
    condition: z.enum(['NEW', 'SECOND_HAND', 'REFURBISHED']).optional().default('NEW'),
    brand: z.string().optional(),
    model: z.string().optional(),
    categoryId: z.string().uuid('Invalid category ID'),
    isActive: z.boolean().optional().default(true),
    isFeatured: z.boolean().optional().default(false),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(3).optional(),
    description: z.string().min(10).optional(),
    price: z.number().positive().optional(),
    mrp: z.number().positive().optional(),
    discount: z.number().min(0).max(100).optional(),
    stock: z.number().int().min(0).optional(),
    condition: z.enum(['NEW', 'SECOND_HAND', 'REFURBISHED']).optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().uuid() }),
});

export const productQuerySchema = z.object({
  query: z.object({
    page: z.string().optional().transform((v) => (v ? parseInt(v) : 1)),
    limit: z.string().optional().transform((v) => (v ? parseInt(v) : 12)),
    category: z.string().optional(),
    condition: z.enum(['NEW', 'SECOND_HAND', 'REFURBISHED']).optional(),
    minPrice: z.string().optional().transform((v) => (v ? parseFloat(v) : undefined)),
    maxPrice: z.string().optional().transform((v) => (v ? parseFloat(v) : undefined)),
    sort: z.enum(['price_asc', 'price_desc', 'newest', 'popular']).optional().default('newest'),
    brand: z.string().optional(),
    q: z.string().optional(),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type ProductQuery = z.infer<typeof productQuerySchema>['query'];
