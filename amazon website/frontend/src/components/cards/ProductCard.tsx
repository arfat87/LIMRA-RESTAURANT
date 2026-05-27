import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Heart, ShoppingCart, Eye, Zap } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import type { Product } from '@/types'
import toast from 'react-hot-toast'

interface ProductCardProps {
  product: Product
  variant?: 'grid' | 'list'
}

export default function ProductCard({ product, variant = 'grid' }: ProductCardProps) {
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [imgError, setImgError] = useState(false)
  const { addItem } = useCartStore()

  const primaryImage = product.images?.[0]?.url || `https://picsum.photos/seed/${product.id}/400/400`
  const discount = product.compare_price
    ? Math.round((1 - product.price / product.compare_price) * 100)
    : null

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    addItem(product)
    toast.success(`${product.title.slice(0, 30)}... added to cart!`, {
      icon: '🛒',
      style: { background: '#1F2937', color: '#fff', border: '1px solid #374151' },
    })
  }

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsWishlisted(!isWishlisted)
    toast(isWishlisted ? 'Removed from wishlist' : '❤️ Added to wishlist!', {
      style: { background: '#1F2937', color: '#fff', border: '1px solid #374151' },
    })
  }

  if (variant === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="card flex gap-4 hover:border-primary/40 hover:-translate-y-0.5"
      >
        <Link to={`/product/${product.id}`} className="shrink-0">
          <img
            src={imgError ? `https://picsum.photos/seed/${product.id}/200/200` : primaryImage}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-32 h-32 object-cover rounded-lg"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/product/${product.id}`}>
            <h3 className="text-white font-medium hover:text-primary transition-colors line-clamp-2 mb-1">
              {product.title}
            </h3>
          </Link>
          <StarRating rating={product.avg_rating} count={product.review_count} />
          <p className="text-xs text-gray-400 mt-1">{product.seller?.business_name}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xl font-bold text-primary">${product.price.toFixed(2)}</span>
            {product.compare_price && (
              <span className="text-sm text-gray-500 line-through">${product.compare_price.toFixed(2)}</span>
            )}
            {discount && <span className="badge bg-green-500/20 text-green-400">{discount}% off</span>}
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button onClick={handleAddToCart} className="btn-primary text-sm py-2 px-4">Add to Cart</button>
          <button
            onClick={handleWishlist}
            className={`btn-secondary text-sm py-2 px-4 ${isWishlisted ? 'text-red-400 border-red-400' : ''}`}
          >
            {isWishlisted ? '❤️' : '🤍'} Save
          </button>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group bg-surface border border-border rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-primary/40 transition-all duration-300"
    >
      {/* Image container */}
      <div className="relative overflow-hidden aspect-square bg-[#0d1117]">
        <Link to={`/product/${product.id}`} className="block w-full h-full">
          <img
            src={imgError ? `https://picsum.photos/seed/${product.id}/400/400` : primaryImage}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount && (
            <span className="badge bg-red-500 text-white font-bold">-{discount}%</span>
          )}
          {product.is_featured && (
            <span className="badge bg-primary text-secondary">
              <Zap size={10} className="mr-0.5" /> Featured
            </span>
          )}
          {product.stock_quantity <= product.low_stock_threshold && product.stock_quantity > 0 && (
            <span className="badge bg-orange-500/90 text-white text-[10px]">Low Stock</span>
          )}
        </div>

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
          <motion.button
            initial={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileInView={{ scale: 1 }}
            onClick={handleAddToCart}
            className="w-10 h-10 rounded-full bg-primary text-secondary flex items-center justify-center shadow-lg hover:bg-primary-600 pointer-events-auto"
          >
            <ShoppingCart size={18} />
          </motion.button>
          <Link
            to={`/product/${product.id}`}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white flex items-center justify-center shadow-lg hover:bg-white/30 pointer-events-auto"
          >
            <Eye size={18} />
          </Link>
        </div>

        {/* Wishlist button */}
        <button
          onClick={handleWishlist}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center transition-all duration-200 hover:bg-red-500 z-10"
        >
          <Heart
            size={15}
            className={isWishlisted ? 'fill-red-400 text-red-400' : 'text-white'}
          />
        </button>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-gray-500 mb-1">{product.seller?.business_name || 'MarketPro'}</p>
        <Link to={`/product/${product.id}`}>
          <h3 className="text-sm font-medium text-gray-200 hover:text-primary transition-colors line-clamp-2 mb-2 leading-tight">
            {product.title}
          </h3>
        </Link>
        <StarRating rating={product.avg_rating} count={product.review_count} />
        <div className="flex items-center justify-between mt-2">
          <div>
            <span className="text-lg font-bold text-primary">${product.price.toFixed(2)}</span>
            {product.compare_price && (
              <span className="ml-2 text-xs text-gray-500 line-through">
                ${product.compare_price.toFixed(2)}
              </span>
            )}
          </div>
        </div>

        {/* Add to cart button */}
        <button
          onClick={handleAddToCart}
          className="w-full mt-3 bg-primary/10 hover:bg-primary text-primary hover:text-secondary text-sm font-semibold py-2 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 border border-primary/30 hover:border-primary"
        >
          <ShoppingCart size={14} />
          Add to Cart
        </button>
      </div>
    </motion.div>
  )
}

export function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            size={12}
            className={star <= Math.round(rating) ? 'fill-accent text-accent' : 'text-gray-600'}
          />
        ))}
      </div>
      {count !== undefined && (
        <span className="text-xs text-gray-500">({count.toLocaleString()})</span>
      )}
    </div>
  )
}
