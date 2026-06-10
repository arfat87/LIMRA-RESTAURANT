import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useWishlistStore } from '../store/wishlistStore';
import { useCartStore } from '../store/cartStore';
import { useQuery } from '@tanstack/react-query';
import { wishlistApi } from '../api/wishlist.api';
import { useAuthStore } from '../store/authStore';
import { formatPrice } from '../utils/formatCurrency';
import { ConditionBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import { QUERY_KEYS } from '../constants/queryKeys';
import toast from 'react-hot-toast';

const Wishlist: React.FC = () => {
  const { productIds, remove } = useWishlistStore();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();

  // For authenticated users, use the API wishlist
  const { data } = useQuery({
    queryKey: [QUERY_KEYS.WISHLIST],
    queryFn: () => wishlistApi.getWishlist().then((r) => (r.data as { data?: unknown[] }).data || []),
    enabled: isAuthenticated,
  });

  const wishlistItems = isAuthenticated
    ? (data as Array<{ product: { id: string; name: string; slug: string; price: number; mrp: number; images: string[]; condition: string } }> || [])
    : [];

  if (productIds.length === 0 && wishlistItems.length === 0) {
    return (
      <>
        <Helmet><title>Wishlist | DSLR WORLD</title></Helmet>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <Heart size={56} className="text-gray-300 mx-auto mb-4" />
          <h1 className="font-poppins font-bold text-2xl text-midnight mb-3">Your wishlist is empty</h1>
          <p className="text-gray-500 mb-8">Save products you love for later.</p>
          <Link to={ROUTES.SHOP}><Button>Browse Products</Button></Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet><title>My Wishlist | DSLR WORLD</title></Helmet>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="font-poppins font-bold text-2xl text-midnight mb-6 flex items-center gap-2">
          <Heart className="text-accent fill-accent" size={24} />My Wishlist
          <span className="text-lg font-normal text-gray-500">({wishlistItems.length || productIds.length} items)</span>
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {wishlistItems.map(({ product }, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl shadow-card overflow-hidden group"
            >
              <Link to={ROUTES.PRODUCT(product.slug)}>
                <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
                  <img src={product.images[0]} alt={product.name} loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 left-2">
                    <ConditionBadge condition={product.condition as 'NEW' | 'SECOND_HAND' | 'REFURBISHED'} />
                  </div>
                </div>
              </Link>
              <div className="p-3">
                <Link to={ROUTES.PRODUCT(product.slug)}>
                  <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 font-poppins hover:text-accent">{product.name}</h3>
                </Link>
                <p className="font-bold text-midnight text-base mt-1">{formatPrice(product.price)}</p>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      addItem({ productId: product.id, name: product.name, slug: product.slug, price: product.price, mrp: product.mrp, image: product.images[0], stock: 99, condition: product.condition, quantity: 1 });
                      toast.success('Added to cart!', { icon: '🛒' });
                    }}
                    className="flex-1 bg-midnight text-white text-xs font-semibold py-2 rounded-xl flex items-center justify-center gap-1 hover:bg-gradient-accent transition-all"
                  >
                    <ShoppingCart size={12} />Add to Cart
                  </button>
                  <button onClick={() => remove(product.id)} className="w-8 h-8 rounded-xl border border-gray-200 flex items-center justify-center text-red-400 hover:bg-red-50">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </>
  );
};

export default Wishlist;
