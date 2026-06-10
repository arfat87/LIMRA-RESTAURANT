import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../store/cartStore';
import { formatPrice } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';
import { Button } from '../ui/Button';

export const CartDrawer: React.FC = () => {
  const { items, isOpen, closeCart, removeItem, updateQty, subtotal, clearCart } = useCartStore();
  const sub = subtotal();
  const FREE_SHIPPING_THRESHOLD = 50000; // ₹500 in paise
  const shippingFee = sub >= FREE_SHIPPING_THRESHOLD ? 0 : 4900; // ₹49
  const total = sub + shippingFee;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-midnight text-white">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} />
                <h2 className="font-poppins font-bold text-lg">
                  My Cart
                  {items.length > 0 && (
                    <span className="ml-2 bg-accent text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {items.length}
                    </span>
                  )}
                </h2>
              </div>
              <button onClick={closeCart} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Items */}
            {items.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag size={40} className="text-gray-300" />
                </div>
                <h3 className="font-poppins font-semibold text-gray-700 mb-2">Your cart is empty</h3>
                <p className="text-gray-500 text-sm mb-6">Add some cameras and accessories to get started!</p>
                <Button onClick={closeCart} rightIcon={<ArrowRight size={15} />}>
                  Start Shopping
                </Button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                  {items.map((item) => (
                    <motion.div
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 bg-gray-50 rounded-xl p-3"
                    >
                      <Link to={ROUTES.PRODUCT(item.slug)} onClick={closeCart}>
                        <img src={item.image || '/placeholder.jpg'} alt={item.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-gray-200" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={ROUTES.PRODUCT(item.slug)} onClick={closeCart}>
                          <p className="text-sm font-semibold text-gray-800 line-clamp-2 font-poppins leading-snug hover:text-accent transition-colors">
                            {item.name}
                          </p>
                        </Link>
                        <p className="text-sm font-bold text-midnight mt-1">{formatPrice(item.price)}</p>
                        {item.mrp > item.price && (
                          <p className="text-xs text-gray-400 line-through">{formatPrice(item.mrp)}</p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1">
                            <button
                              onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQty(item.productId, item.quantity - 1)}
                              className="text-gray-500 hover:text-accent transition-colors"
                            >
                              {item.quantity <= 1 ? <Trash2 size={13} className="text-red-500" /> : <Minus size={13} />}
                            </button>
                            <span className="text-sm font-bold text-gray-700 w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQty(item.productId, item.quantity + 1)}
                              disabled={item.quantity >= item.stock}
                              className="text-gray-500 hover:text-accent transition-colors disabled:opacity-40"
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button onClick={() => removeItem(item.productId)} className="text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Summary */}
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  {/* Free shipping progress */}
                  {sub < FREE_SHIPPING_THRESHOLD && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                        <span>Add {formatPrice(FREE_SHIPPING_THRESHOLD - sub)} more for free shipping!</span>
                        <span>🚚</span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-accent rounded-full transition-all"
                          style={{ width: `${Math.min((sub / FREE_SHIPPING_THRESHOLD) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span><span>{formatPrice(sub)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Shipping</span>
                      <span className={shippingFee === 0 ? 'text-emerald-600 font-semibold' : ''}>
                        {shippingFee === 0 ? 'FREE' : formatPrice(shippingFee)}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-midnight text-base border-t pt-2">
                      <span>Total</span><span>{formatPrice(total)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Link to={ROUTES.CHECKOUT} onClick={closeCart}>
                      <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />}>
                        Checkout
                      </Button>
                    </Link>
                    <Link to={ROUTES.CART} onClick={closeCart}>
                      <Button fullWidth variant="ghost" size="sm">View Full Cart</Button>
                    </Link>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
