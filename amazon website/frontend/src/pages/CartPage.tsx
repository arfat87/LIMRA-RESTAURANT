import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Minus, Plus, Trash2, ArrowRight, Tag, ShoppingBag, ArrowLeft, RefreshCw } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { Link as RouterLink } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function CartPage() {
  const { items, removeItem, updateQuantity, saveForLater, moveToCart, getSubtotal, getShippingCost, getTaxAmount, getTotal, getSavedItems } = useCartStore()
  const [coupon, setCoupon] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null)
  const [discount, setDiscount] = useState(0)

  const activeItems = items.filter(i => !i.saved_for_later)
  const savedItems = getSavedItems()
  const subtotal = getSubtotal()
  const shipping = getShippingCost()
  const tax = getTaxAmount()
  const total = getTotal() - discount

  const applyCoupon = () => {
    if (coupon.toUpperCase() === 'SAVE10') {
      setDiscount(subtotal * 0.1)
      setAppliedCoupon(coupon)
      toast.success('Coupon applied! 10% off your order 🎉', { style: { background: '#1F2937', color: '#fff' } })
    } else if (coupon.toUpperCase() === 'WELCOME20') {
      setDiscount(subtotal * 0.2)
      setAppliedCoupon(coupon)
      toast.success('Coupon applied! 20% off 🎉', { style: { background: '#1F2937', color: '#fff' } })
    } else {
      toast.error('Invalid coupon code', { style: { background: '#1F2937', color: '#fff' } })
    }
  }

  if (activeItems.length === 0 && savedItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}>
          <ShoppingBag size={96} className="text-gray-600 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-3">Your cart is empty</h2>
          <p className="text-gray-400 mb-8 max-w-sm mx-auto">
            Looks like you haven't added anything yet. Discover amazing products!
          </p>
          <Link to="/products" className="btn-primary inline-flex items-center gap-2">
            <ShoppingBag size={18} /> Start Shopping
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <RouterLink to="/products" className="text-gray-400 hover:text-primary transition-colors">
          <ArrowLeft size={20} />
        </RouterLink>
        <h1 className="text-2xl font-bold text-white">
          Shopping Cart
          <span className="text-gray-400 font-normal text-lg ml-2">({activeItems.length} items)</span>
        </h1>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Cart items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Active items */}
          {activeItems.map(item => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className="card flex gap-4"
            >
              <RouterLink to={`/product/${item.product.id}`} className="shrink-0">
                <img
                  src={item.product.images?.[0]?.url}
                  alt={item.product.title}
                  className="w-24 h-24 md:w-28 md:h-28 object-cover rounded-lg"
                />
              </RouterLink>
              <div className="flex-1 min-w-0">
                <RouterLink to={`/product/${item.product.id}`}>
                  <h3 className="font-medium text-white hover:text-primary transition-colors line-clamp-2 mb-1">
                    {item.product.title}
                  </h3>
                </RouterLink>
                {item.variant && (
                  <p className="text-xs text-gray-400">{item.variant.name}: {item.variant.value}</p>
                )}
                <p className="text-xs text-gray-500">Sold by: {item.product.seller?.business_name}</p>
                <p className="text-green-400 text-xs mt-1">✓ In Stock — Ships in 1-2 days</p>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                  {/* Quantity */}
                  <div className="flex items-center border border-border rounded-lg overflow-hidden">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="px-3 py-1.5 hover:bg-surface text-white transition-colors">
                      <Minus size={14} />
                    </button>
                    <span className="px-4 py-1.5 text-white font-medium border-x border-border text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="px-3 py-1.5 hover:bg-surface text-white transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button onClick={() => saveForLater(item.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                      <RefreshCw size={12} /> Save for later
                    </button>
                    <button onClick={() => { removeItem(item.id); toast('Item removed', { style: { background: '#1F2937', color: '#fff' } }) }} className="text-xs text-red-400 hover:underline flex items-center gap-1">
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-primary">
                  ${((item.product.price + (item.variant?.price_modifier ?? 0)) * item.quantity).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">${(item.product.price + (item.variant?.price_modifier ?? 0)).toFixed(2)} each</p>
              </div>
            </motion.div>
          ))}

          {/* Saved for later */}
          {savedItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">Saved for Later ({savedItems.length})</h3>
              {savedItems.map(item => (
                <motion.div key={item.id} className="card flex gap-4 opacity-75">
                  <img
                    src={item.product.images?.[0]?.url}
                    alt={item.product.title}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-white text-sm line-clamp-2 mb-1">{item.product.title}</p>
                    <p className="text-primary font-bold">${item.product.price.toFixed(2)}</p>
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => moveToCart(item.id)} className="text-xs text-primary hover:underline">Move to Cart</button>
                      <button onClick={() => removeItem(item.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Coupon */}
          <div className="card">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <Tag size={18} className="text-primary" />
              Coupon Code
            </h3>
            {appliedCoupon ? (
              <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div>
                  <p className="text-green-400 font-semibold">{appliedCoupon}</p>
                  <p className="text-xs text-gray-400">-${discount.toFixed(2)} off your order</p>
                </div>
                <button onClick={() => { setAppliedCoupon(null); setDiscount(0); setCoupon('') }} className="text-xs text-red-400 hover:underline">Remove</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  value={coupon}
                  onChange={e => setCoupon(e.target.value.toUpperCase())}
                  placeholder="Enter coupon (try SAVE10 or WELCOME20)"
                  className="input flex-1 text-sm"
                />
                <button onClick={applyCoupon} className="btn-outline text-sm py-2 whitespace-nowrap">Apply</button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order summary */}
        <div className="lg:col-span-1">
          <div className="card sticky top-24 space-y-3">
            <h3 className="text-lg font-bold text-white">Order Summary</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal ({activeItems.reduce((s, i) => s + i.quantity, 0)} items)</span>
                <span className="text-white">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">Coupon Discount</span>
                  <span className="text-green-400">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Shipping</span>
                <span className={shipping === 0 ? 'text-green-400' : 'text-white'}>
                  {shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Estimated Tax (8%)</span>
                <span className="text-white">${tax.toFixed(2)}</span>
              </div>
            </div>
            <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
              <span className="text-white">Total</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
            {shipping > 0 && subtotal < 50 && (
              <p className="text-xs text-gray-400 text-center">
                Add ${(50 - subtotal).toFixed(2)} more for <span className="text-green-400">FREE shipping</span>
              </p>
            )}
            <RouterLink to="/checkout">
              <motion.button
                whileTap={{ scale: 0.98 }}
                className="w-full btn-primary flex items-center justify-center gap-2 py-3 mt-2"
              >
                Proceed to Checkout
                <ArrowRight size={18} />
              </motion.button>
            </RouterLink>
            <RouterLink to="/products" className="block text-center text-sm text-gray-400 hover:text-primary transition-colors">
              ← Continue Shopping
            </RouterLink>

            {/* Security badges */}
            <div className="border-t border-border pt-3 flex justify-center gap-3 flex-wrap">
              {['SSL Secure', '256-bit', 'PCI DSS'].map(b => (
                <span key={b} className="text-[10px] text-gray-500 border border-border rounded px-2 py-0.5">{b}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
