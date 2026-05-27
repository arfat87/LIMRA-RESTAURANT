export interface User {
  id: string
  email: string
  role: 'customer' | 'seller' | 'admin'
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  user_id: string
  full_name: string
  avatar_url?: string
  phone?: string
  bio?: string
  date_of_birth?: string
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  user_id: string
  label: string
  full_name: string
  phone: string
  address_line1: string
  address_line2?: string
  city: string
  state: string
  postal_code: string
  country: string
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image_url?: string
  icon?: string
  parent_id?: string
  is_active: boolean
  sort_order: number
  created_at: string
}

export interface Brand {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  website_url?: string
  is_active: boolean
  created_at: string
}

export interface ProductImage {
  id: string
  product_id: string
  url: string
  alt_text?: string
  sort_order: number
  is_primary: boolean
  created_at: string
}

export interface ProductVariant {
  id: string
  product_id: string
  name: string
  value: string
  price_modifier: number
  stock_quantity: number
  sku?: string
  created_at: string
}

export interface Product {
  id: string
  seller_id: string
  category_id: string
  brand_id?: string
  title: string
  slug: string
  description: string
  short_description?: string
  price: number
  compare_price?: number
  cost_price?: number
  sku?: string
  stock_quantity: number
  low_stock_threshold: number
  weight?: number
  dimensions?: {
    length: number
    width: number
    height: number
    unit: string
  }
  tags?: string[]
  status: 'draft' | 'active' | 'inactive' | 'out_of_stock'
  is_featured: boolean
  is_digital: boolean
  avg_rating: number
  review_count: number
  images: ProductImage[]
  variants?: ProductVariant[]
  category?: Category
  brand?: Brand
  seller?: Seller
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  product: Product
  variant?: ProductVariant
  quantity: number
  saved_for_later?: boolean
}

export interface WishlistItem {
  id: string
  user_id: string
  product_id: string
  product?: Product
  created_at: string
}

export interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  min_order_amount?: number
  max_uses?: number
  uses_count: number
  expires_at?: string
  is_active: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  variant_id?: string
  seller_id: string
  title: string
  image_url?: string
  price: number
  quantity: number
  total: number
  product?: Product
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'

export interface Shipment {
  id: string
  order_id: string
  tracking_number?: string
  carrier?: string
  status: string
  estimated_delivery?: string
  shipped_at?: string
  delivered_at?: string
  events: ShipmentEvent[]
}

export interface ShipmentEvent {
  status: string
  description: string
  timestamp: string
  location?: string
}

export interface Payment {
  id: string
  order_id: string
  method: 'credit_card' | 'debit_card' | 'paypal' | 'cod' | 'wallet'
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
  amount: number
  currency: string
  transaction_id?: string
  paid_at?: string
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string
  status: OrderStatus
  subtotal: number
  shipping_cost: number
  tax_amount: number
  discount_amount: number
  total: number
  currency: string
  shipping_address: Address
  coupon_code?: string
  notes?: string
  items: OrderItem[]
  payment?: Payment
  shipment?: Shipment
  created_at: string
  updated_at: string
}

export interface Review {
  id: string
  product_id: string
  user_id: string
  order_id?: string
  rating: number
  title?: string
  content: string
  images?: string[]
  is_verified: boolean
  helpful_count: number
  user?: Profile
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: 'order' | 'promo' | 'system' | 'review' | 'shipping'
  title: string
  message: string
  data?: Record<string, unknown>
  is_read: boolean
  created_at: string
}

export interface Seller {
  id: string
  user_id: string
  business_name: string
  slug: string
  description?: string
  logo_url?: string
  banner_url?: string
  email: string
  phone?: string
  website?: string
  avg_rating: number
  total_reviews: number
  total_sales: number
  is_verified: boolean
  is_active: boolean
  created_at: string
}

export interface Analytics {
  total_revenue: number
  total_orders: number
  total_users: number
  total_products: number
  revenue_chart: { date: string; revenue: number }[]
  orders_chart: { date: string; orders: number }[]
  top_products: { product: Product; sales: number }[]
  top_sellers: { seller: Seller; revenue: number }[]
}

export interface FlashDeal {
  id: string
  product: Product
  discount_percentage: number
  original_price: number
  deal_price: number
  ends_at: string
  sold_count: number
  total_quantity: number
}

export interface SearchFilters {
  query?: string
  category_id?: string
  brand_id?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  sort_by?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'popular'
  in_stock?: boolean
  page?: number
  per_page?: number
}
