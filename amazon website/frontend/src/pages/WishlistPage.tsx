import { motion } from 'framer-motion'
import { Heart, ShoppingCart, Trash2, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCartStore } from '@/stores/cartStore'
import { mockProducts } from '@/data/mockData'
import ProductCard from '@/components/cards/ProductCard'
import toast from 'react-hot-toast'

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState(mockProducts.slice(0, 6))
  const { addItem } = useCartStore()

  const removeItem = (id: string) => {
    setWishlistItems(prev => prev.filter(p => p.id !== id))
    toast('Removed from wishlist', { style: { background: '#1F2937', color: '#fff' } })
  }

  const addAllToCart = () => {
    wishlistItems.forEach(p => addItem(p))
    toast.success(`${wishlistItems.length} items added to cart! 🛒`, {
      style: { background: '#1F2937', color: '#fff' },
    })
  }

  if (wishlistItems.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Heart size={80} className="text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-3">Your wishlist is empty</h2>
        <p className="text-gray-400 mb-6">Save items you love to your wishlist and buy them later</p>
        <Link to="/products" className="btn-primary">
          <ShoppingBag size={18} className="mr-2 inline" /> Start Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Heart className="text-red-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-white">My Wishlist</h1>
            <p className="text-gray-400 text-sm">{wishlistItems.length} saved items</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={addAllToCart}
          className="btn-primary flex items-center gap-2"
        >
          <ShoppingCart size={18} /> Add All to Cart
        </motion.button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {wishlistItems.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="relative group"
          >
            <ProductCard product={product} />
            <button
              onClick={() => removeItem(product.id)}
              className="absolute top-2 left-2 w-8 h-8 bg-red-500/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 size={14} className="text-white" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
