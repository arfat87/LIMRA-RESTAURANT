import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Heart, ShoppingCart, Truck, RotateCcw, Shield, Minus, Plus, ChevronRight, Check, Share2 } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { mockProducts } from '@/data/mockData'
import ProductCard from '@/components/cards/ProductCard'
import { StarRating } from '@/components/cards/ProductCard'
import toast from 'react-hot-toast'
import type { ProductVariant } from '@/types'

const TABS = ['Description', 'Specifications', 'Shipping']

const mockReviews = [
  { id: 'r1', user: { full_name: 'Alex Johnson', avatar_url: 'https://picsum.photos/seed/u1/50/50' }, rating: 5, title: 'Absolutely Amazing!', content: 'This product exceeded all my expectations. The quality is outstanding and it arrived quickly. Highly recommend!', is_verified: true, helpful_count: 24, created_at: '2024-05-01' },
  { id: 'r2', user: { full_name: 'Sarah M.', avatar_url: 'https://picsum.photos/seed/u2/50/50' }, rating: 4, title: 'Great value for money', content: 'Really happy with this purchase. Works exactly as described. Only minor issue was the packaging could be better.', is_verified: true, helpful_count: 12, created_at: '2024-04-20' },
  { id: 'r3', user: { full_name: 'Mike D.', avatar_url: 'https://picsum.photos/seed/u3/50/50' }, rating: 5, title: 'Perfect!', content: 'Been using it for 2 months now and no issues at all. Would buy again!', is_verified: false, helpful_count: 8, created_at: '2024-04-10' },
]

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const product = mockProducts.find(p => p.id === id) ?? mockProducts[0]
  const related = mockProducts.filter(p => p.category_id === product.category_id && p.id !== product.id).slice(0, 4)

  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant>>({})
  const [activeTab, setActiveTab] = useState(TABS[0])
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const { addItem } = useCartStore()
  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : null

  const colorVariants = product.variants?.filter(v => v.name === 'Color') ?? []
  const sizeVariants = product.variants?.filter(v => v.name === 'Size') ?? []

  const handleAddToCart = () => {
    const variant = Object.values(selectedVariants)[0]
    addItem(product, variant, quantity)
    toast.success('Added to cart! 🛒', {
      style: { background: '#1F2937', color: '#fff', border: '1px solid #374151' },
    })
  }

  const handleBuyNow = () => {
    handleAddToCart()
    window.location.href = '/checkout'
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  const ratingDist = [
    { stars: 5, pct: 68 },
    { stars: 4, pct: 20 },
    { stars: 3, pct: 8 },
    { stars: 2, pct: 3 },
    { stars: 1, pct: 1 },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link to="/" className="hover:text-primary transition-colors">Home</Link>
        <ChevronRight size={14} />
        <Link to="/products" className="hover:text-primary transition-colors">Products</Link>
        <ChevronRight size={14} />
        <Link to={`/category/${product.category?.slug}`} className="hover:text-primary transition-colors">
          {product.category?.name}
        </Link>
        <ChevronRight size={14} />
        <span className="text-white truncate max-w-xs">{product.title}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 mb-12">
        {/* Image gallery */}
        <div className="space-y-3">
          {/* Main image */}
          <div
            className="relative aspect-square bg-[#0d1117] rounded-2xl overflow-hidden cursor-zoom-in border border-border"
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleMouseMove}
          >
            <img
              src={product.images?.[selectedImage]?.url ?? `https://picsum.photos/seed/${product.id}/600/600`}
              alt={product.title}
              className="w-full h-full object-cover transition-transform duration-300"
              style={zoom ? {
                transform: 'scale(1.8)',
                transformOrigin: `${mousePos.x}% ${mousePos.y}%`,
              } : {}}
            />
            {discount && (
              <div className="absolute top-4 left-4 badge bg-red-500 text-white font-bold text-base px-3 py-1">
                -{discount}% OFF
              </div>
            )}
            <button
              onClick={() => { setIsWishlisted(!isWishlisted); toast(isWishlisted ? 'Removed from wishlist' : '❤️ Saved!', { style: { background: '#1F2937', color: '#fff' } }) }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <Heart size={18} className={isWishlisted ? 'fill-red-400 text-red-400' : 'text-white'} />
            </button>
            <button
              onClick={() => { navigator.share?.({ title: product.title, url: window.location.href }); toast('Link copied!', { style: { background: '#1F2937', color: '#fff' } }) }}
              className="absolute top-4 right-16 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <Share2 size={18} className="text-white" />
            </button>
          </div>

          {/* Thumbnails */}
          <div className="flex gap-2">
            {product.images?.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setSelectedImage(i)}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${i === selectedImage ? 'border-primary' : 'border-border hover:border-gray-500'}`}
              >
                <img src={img.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Product info */}
        <div className="space-y-5">
          {/* Brand & title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              {product.seller && (
                <Link to={`/seller/${product.seller.slug}`} className="text-sm text-primary hover:underline font-medium">
                  {product.seller.business_name}
                </Link>
              )}
              {product.seller?.is_verified && (
                <span className="badge bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Check size={10} className="mr-0.5" /> Verified
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{product.title}</h1>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <StarRating rating={product.avg_rating} count={product.review_count} />
            <span className="text-sm text-gray-400">{product.avg_rating.toFixed(1)}/5</span>
            <span className="text-gray-600">·</span>
            <span className="text-sm text-gray-400">{product.stock_quantity} in stock</span>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-black text-primary">${product.price.toFixed(2)}</span>
            {product.compare_price && (
              <>
                <span className="text-xl text-gray-500 line-through">${product.compare_price.toFixed(2)}</span>
                <span className="badge bg-green-500/20 text-green-400 border border-green-500/30 text-sm">
                  Save ${(product.compare_price - product.price).toFixed(2)}
                </span>
              </>
            )}
          </div>

          {/* Color variants */}
          {colorVariants.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-2">
                Color: <span className="text-white">{selectedVariants['Color']?.value ?? 'Select'}</span>
              </p>
              <div className="flex gap-2 flex-wrap">
                {colorVariants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariants(prev => ({ ...prev, Color: v }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                      selectedVariants['Color']?.id === v.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {v.value}
                    {v.price_modifier > 0 && <span className="text-xs text-primary ml-1">+${v.price_modifier}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size variants */}
          {sizeVariants.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-300 mb-2">Size</p>
              <div className="flex gap-2 flex-wrap">
                {sizeVariants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariants(prev => ({ ...prev, Size: v }))}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all duration-200 ${
                      selectedVariants['Size']?.id === v.id
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    {v.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-2">Quantity</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  className="px-4 py-2.5 hover:bg-surface text-white transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="px-6 py-2.5 text-white font-bold border-x border-border">{quantity}</span>
                <button
                  onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
                  className="px-4 py-2.5 hover:bg-surface text-white transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>
              <span className="text-sm text-gray-500">{product.stock_quantity} available</span>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleAddToCart}
              className="flex-1 btn-secondary flex items-center justify-center gap-2 py-3"
            >
              <ShoppingCart size={20} />
              Add to Cart
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleBuyNow}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-3"
            >
              Buy Now
            </motion.button>
          </div>

          {/* Delivery info */}
          <div className="space-y-2.5 p-4 bg-surface border border-border rounded-xl">
            <div className="flex items-start gap-3">
              <Truck size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Free Delivery</p>
                <p className="text-xs text-gray-400">Estimated delivery: 2-5 business days. Free on orders $50+.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RotateCcw size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Easy Returns</p>
                <p className="text-xs text-gray-400">30-day hassle-free return policy. Full refund guaranteed.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield size={18} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white">Secure Checkout</p>
                <p className="text-xs text-gray-400">Your payment information is always protected.</p>
              </div>
            </div>
          </div>

          {/* Seller card */}
          {product.seller && (
            <div className="p-4 bg-surface border border-border rounded-xl flex items-center gap-3">
              <img
                src={product.seller.logo_url ?? `https://picsum.photos/seed/${product.seller.id}/60/60`}
                alt={product.seller.business_name}
                className="w-12 h-12 rounded-lg object-cover"
              />
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{product.seller.business_name}</p>
                <div className="flex items-center gap-1">
                  <Star size={12} className="fill-accent text-accent" />
                  <span className="text-xs text-gray-400">{product.seller.avg_rating} · {product.seller.total_reviews} reviews</span>
                </div>
              </div>
              <Link to={`/seller/${product.seller.slug}`} className="text-xs text-primary hover:underline">
                View Shop →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-12">
        <div className="flex border-b border-border mb-6">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab
                  ? 'text-primary border-primary'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'Description' && (
              <div className="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                <p>{product.description}</p>
                <p className="mt-4">Our products are crafted with care and precision. Each item undergoes rigorous quality control to ensure you receive nothing but the best. Whether you're a first-time buyer or a returning customer, we're committed to exceeding your expectations.</p>
                <ul className="mt-4 space-y-2">
                  <li>✅ Premium quality materials</li>
                  <li>✅ Rigorous quality testing</li>
                  <li>✅ Eco-friendly packaging</li>
                  <li>✅ 1-year manufacturer warranty</li>
                </ul>
              </div>
            )}
            {activeTab === 'Specifications' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  ['Brand', product.seller?.business_name ?? 'MarketPro'],
                  ['Model', product.sku ?? 'N/A'],
                  ['Category', product.category?.name ?? 'General'],
                  ['Stock', `${product.stock_quantity} units`],
                  ['Rating', `${product.avg_rating}/5 (${product.review_count} reviews)`],
                  ['Shipping', 'Free on $50+'],
                  ['Return Policy', '30 days'],
                  ['Warranty', '1 Year'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-2 border-b border-border/50">
                    <span className="text-sm text-gray-400">{k}</span>
                    <span className="text-sm text-white font-medium">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {activeTab === 'Shipping' && (
              <div className="space-y-4">
                {[
                  { method: 'Standard Shipping', time: '5-7 business days', price: 'Free on orders $50+', icon: '📦' },
                  { method: 'Express Shipping', time: '2-3 business days', price: '$9.99', icon: '🚀' },
                  { method: 'Next Day Delivery', time: '1 business day', price: '$19.99', icon: '⚡' },
                ].map(s => (
                  <div key={s.method} className="flex items-center gap-4 p-4 bg-surface border border-border rounded-xl">
                    <span className="text-2xl">{s.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium text-white">{s.method}</p>
                      <p className="text-sm text-gray-400">{s.time}</p>
                    </div>
                    <span className="text-primary font-bold">{s.price}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Reviews */}
      <div className="mb-12">
        <h2 className="section-title mb-6">Customer Reviews</h2>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Rating summary */}
          <div className="card">
            <div className="text-center mb-4">
              <p className="text-6xl font-black text-primary">{product.avg_rating.toFixed(1)}</p>
              <StarRating rating={product.avg_rating} count={product.review_count} />
              <p className="text-sm text-gray-400 mt-1">{product.review_count.toLocaleString()} reviews</p>
            </div>
            <div className="space-y-2">
              {ratingDist.map(({ stars, pct }) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-6 text-right">{stars}★</span>
                  <div className="flex-1 h-2 bg-[#0d1117] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="h-full bg-primary rounded-full"
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8">{pct}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Review list */}
          <div className="lg:col-span-2 space-y-4">
            {mockReviews.map(review => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="card"
              >
                <div className="flex items-start gap-3 mb-3">
                  <img src={review.user.avatar_url} alt={review.user.full_name} className="w-10 h-10 rounded-full" />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white text-sm">{review.user.full_name}</p>
                      {review.is_verified && (
                        <span className="badge bg-green-500/20 text-green-400 text-[10px]">
                          <Check size={8} className="mr-0.5" /> Verified
                        </span>
                      )}
                    </div>
                    <StarRating rating={review.rating} />
                  </div>
                  <span className="ml-auto text-xs text-gray-500">{review.created_at}</span>
                </div>
                {review.title && (
                  <p className="font-semibold text-white mb-1">{review.title}</p>
                )}
                <p className="text-sm text-gray-300">{review.content}</p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">Helpful ({review.helpful_count})?</span>
                  <button className="text-xs text-primary hover:underline">Yes</button>
                  <button className="text-xs text-gray-400 hover:underline">No</button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Related products */}
      {related.length > 0 && (
        <div>
          <h2 className="section-title mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map(p => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
