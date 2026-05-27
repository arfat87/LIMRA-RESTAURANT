import { motion, AnimatePresence } from 'framer-motion'
import { X, ShoppingCart, Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useCartStore } from '@/stores/cartStore'

export default function CartDrawer() {
  const { items, isOpen, closeDrawer, removeItem, updateQuantity, getSubtotal, getShippingCost, getTaxAmount, getTotal } = useCartStore()
  const navigate = useNavigate()

  const activeItems = items.filter(i => !i.saved_for_later)
  const subtotal = getSubtotal()
  const shipping = getShippingCost()
  const tax = getTaxAmount()
  const total = getTotal()

  const handleCheckout = () => {
    closeDrawer()
    navigate('/checkout')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={closeDrawer}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#1F2937] border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-primary" size={22} />
                <h2 className="text-lg font-bold text-white">
                  Shopping Cart
                  {activeItems.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({activeItems.length} {activeItems.length === 1 ? 'item' : 'items'})
                    </span>
                  )}
                </h2>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 hover:bg-surface rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto py-4 px-5 space-y-3">
              <AnimatePresence mode="popLayout">
                {activeItems.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-64 text-center"
                  >
                    <ShoppingBag size={64} className="text-gray-600 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Your cart is empty</h3>
                    <p className="text-sm text-gray-500 mb-4">Add items to get started!</p>
                    <Link
                      to="/products"
                      onClick={closeDrawer}
                      className="btn-primary text-sm"
                    >
                      Start Shopping
                    </Link>
                  </motion.div>
                ) : (
                  activeItems.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20, height: 0 }}
                      className="flex gap-3 p-3 bg-surface rounded-xl border border-border"
                    >
                      {/* Image */}
                      <Link to={`/product/${item.product.id}`} onClick={closeDrawer} className="shrink-0">
                        <img
                          src={item.product.images?.[0]?.url || `https://picsum.photos/seed/${item.product.id}/80/80`}
                          alt={item.product.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      </Link>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/product/${item.product.id}`}
                          onClick={closeDrawer}
                          className="text-sm text-white hover:text-primary font-medium line-clamp-1 transition-colors"
                        >
                          {item.product.title}
                        </Link>
                        {item.variant && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {item.variant.name}: {item.variant.value}
                          </p>
                        )}
                        <p className="text-primary font-bold text-sm mt-1">
                          ${(item.product.price + (item.variant?.price_modifier ?? 0)).toFixed(2)}
                        </p>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="w-7 h-7 rounded-lg bg-[#0d1117] border border-border flex items-center justify-center hover:border-primary transition-colors"
                          >
                            <Minus size={12} className="text-white" />
                          </button>
                          <span className="text-sm text-white font-medium w-6 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="w-7 h-7 rounded-lg bg-[#0d1117] border border-border flex items-center justify-center hover:border-primary transition-colors"
                          >
                            <Plus size={12} className="text-white" />
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="ml-auto p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} className="text-red-400" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Footer summary */}
            {activeItems.length > 0 && (
              <div className="border-t border-border px-5 py-4 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Subtotal</span>
                    <span className="text-white">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Shipping</span>
                    <span className={shipping === 0 ? 'text-green-400' : 'text-white'}>
                      {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-400">
                    <span>Tax (8%)</span>
                    <span className="text-white">${tax.toFixed(2)}</span>
                  </div>
                  {shipping === 0 && (
                    <p className="text-xs text-green-400">🎉 You qualify for free shipping!</p>
                  )}
                  {shipping > 0 && (
                    <p className="text-xs text-gray-500">
                      Add ${(50 - subtotal).toFixed(2)} more for free shipping
                    </p>
                  )}
                </div>

                <div className="flex justify-between font-bold border-t border-border pt-2">
                  <span className="text-white">Total</span>
                  <span className="text-primary text-lg">${total.toFixed(2)}</span>
                </div>

                <button
                  onClick={handleCheckout}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  Proceed to Checkout
                  <ArrowRight size={18} />
                </button>

                <Link
                  to="/cart"
                  onClick={closeDrawer}
                  className="block text-center text-sm text-primary hover:text-primary-400 transition-colors"
                >
                  View Full Cart
                </Link>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
