export type Condition = 'NEW' | 'SECOND_HAND' | 'REFURBISHED';

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  description?: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;   // in paise
  mrp: number;     // in paise
  discount: number;
  stock: number;
  images: string[];
  condition: Condition;
  brand?: string;
  model?: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryId: string;
  category: { name: string; slug: string };
  _count?: { reviews: number };
  reviews?: Review[];
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  userId: string;
  productId: string;
  rating: number;
  comment?: string;
  images: string[];
  createdAt: string;
  user: { name: string; avatar?: string };
}

export interface ProductQuery {
  page?: number;
  limit?: number;
  category?: string;
  condition?: Condition;
  minPrice?: number;
  maxPrice?: number;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  brand?: string;
  q?: string;
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
