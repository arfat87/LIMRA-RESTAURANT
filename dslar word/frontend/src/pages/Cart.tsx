import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { formatPrice } from '../utils/formatCurrency';
import { ROUTES } from '../constants/routes';
import { Button } from '../components/ui/Button';
import { ConditionBadge } from '../components/ui/Badge';

const Cart: React.FC = () => {
  const { items, removeItem, updateQty, subtotal, clearCart } = useCartStore();
  const sub = subtotal();
  const FREE_SHIPPING = 50000;
  const shipping = sub >= FREE_SHIPPING ? 0 : 4900;
  const total = sub + shipping;

  if (items.length === 0) {
    return (
      <>
        <Helmet><title>My Cart | DSLR WORLD</title></Helmet>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag size={40} className="text-gray-300" />
          </div>
          <h1 className="font-poppins font-bold text-2xl text-midnight mb-3">Your cart is empty</h1>
          <p className="text-gray-500 mb-8">Add cameras, lenses and accessories to your cart to continue.</p>
          <Link to={ROUTES.SHOP}><Button size="lg" rightIcon={<ArrowRight size={16} />}>Start Shopping</Button></Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>My Cart ({items.length} items) | DSLR WORLD</title></Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-poppins font-bold text-2xl text-midnight">My Cart</h1>
          <button onClick={clearCart} className="text-sm text-red-500 hover:text-red-700 hover:underline">Clear Cart</button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Items */}
          <div className="flex-1 space-y-4">
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.productId}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="bg-white rounded-2xl shadow-card p-4 flex gap-4"
                >
                  <Link to={ROUTES.PRODUCT(item.slug)}>
                    <img src={item.image || '/placeholder.jpg'} alt={item.name}
                      className="w-24 h-24 object-cover rounded-xl border border-gray-100 flex-shrink-0" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <ConditionBadge condition={item.condition as 'NEW' | 'SECOND_HAND' | 'REFURBISHED'} />
                        <Link to={ROUTES.PRODUCT(item.slug)}>
                          <h3 className="font-poppins font-semibold text-gray-800 mt-1 hover:text-accent transition-colors line-clamp-2">{item.name}</h3>
                        </Link>
                      </div>
                      <button onClick={() => removeItem(item.productId)} className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-1.5">
                          <button onClick={() => item.quantity <= 1 ? removeItem(item.productId) : updateQty(item.productId, item.quantity - 1)} className="text-gray-500 hover:text-accent">
                            <Minus size={14} />
                          </button>
                          <span className="text-sm font-bold text-gray-700 w-6 text-center">{item.quantity}</span>
                          <button onClick={() => updateQty(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock} className="text-gray-500 hover:text-accent disabled:opacity-40">
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-midnight font-poppins">{formatPrice(item.price * item.quantity)}</p>
                        {item.mrp > item.price && <p className="text-xs text-gray-400 line-through">{formatPrice(item.mrp * item.quantity)}</p>}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Summary */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-card p-6 sticky top-24">
              <h2 className="font-poppins font-bold text-lg text-midnight mb-5">Order Summary</h2>
              {sub < FREE_SHIPPING && (
                <div className="mb-4 bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-xs text-amber-700 mb-2">Add {formatPrice(FREE_SHIPPING - sub)} more for free shipping! 🚚</p>
                  <div className="h-1.5 bg-amber-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min((sub / FREE_SHIPPING) * 100, 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="space-y-3 text-sm border-b border-gray-100 pb-4 mb-4">
                <div className="flex justify-between text-gray-600"><span>Subtotal ({items.length} items)</span><span>{formatPrice(sub)}</span></div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span className={shipping === 0 ? 'text-emerald-600 font-bold' : ''}>{shipping === 0 ? 'FREE' : formatPrice(shipping)}</span>
                </div>
              </div>
              <div className="flex justify-between font-bold text-midnight text-lg mb-6">
                <span>Total</span><span>{formatPrice(total)}</span>
              </div>
              <Link to={ROUTES.CHECKOUT}>
                <Button fullWidth size="lg" rightIcon={<ArrowRight size={16} />}>Proceed to Checkout</Button>
              </Link>
              <Link to={ROUTES.SHOP} className="block text-center text-accent text-sm font-semibold mt-3 hover:underline">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Cart;
