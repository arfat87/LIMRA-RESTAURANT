import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingCart, Heart } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { useWishlistStore } from '../../store/wishlistStore';
import type { Product } from '../../types/product.types';
import { ConditionBadge } from '../ui/Badge';
import { Rating } from '../ui/Rating';
import { formatPrice } from '../../utils/formatCurrency';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { addItem } = useCartStore();
  const { toggle, has } = useWishlistStore();
  const isWishlisted = has(product.id);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    addItem({
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      mrp: product.mrp,
      image: product.images[0] || '',
      stock: product.stock,
      condition: product.condition,
      quantity: 1,
    });
    toast.success(`${product.name.slice(0, 25)}… added to cart!`, {
      icon: '🛒', duration: 2000,
    });
  };

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    toggle(product.id);
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist', {
      icon: isWishlisted ? '💔' : '❤️', duration: 1500,
    });
  };

  const discount = product.mrp > product.price
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="group"
    >
      <Link to={ROUTES.PRODUCT(product.slug)} className="block bg-white rounded-2xl shadow-card hover:shadow-card-hover transition-all duration-300 overflow-hidden">
        {/* Image */}
        <div className="relative overflow-hidden bg-gray-50 aspect-[4/3]">
          <img
            src={product.images[0] || '/placeholder-camera.jpg'}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {/* Badges */}
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            <ConditionBadge condition={product.condition} />
            {discount >= 5 && (
              <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {discount}% OFF
              </span>
            )}
          </div>
          {/* Stock warning */}
          {product.stock <= 5 && product.stock > 0 && (
            <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
              Only {product.stock} left!
            </div>
          )}
          {product.stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="bg-white text-gray-800 text-xs font-bold px-3 py-1 rounded-full">Out of Stock</span>
            </div>
          )}
          {/* Wishlist button */}
          <button
            onClick={handleWishlist}
            className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-md hover:bg-white transition-all"
          >
            <Heart
              size={15}
              className={isWishlisted ? 'text-accent fill-accent' : 'text-gray-500'}
            />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5">
          {product.brand && (
            <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-0.5">{product.brand}</p>
          )}
          <h3 className="text-sm font-semibold text-gray-800 line-clamp-2 font-poppins leading-snug mb-2">
            {product.name}
          </h3>
          <Rating value={4.5} size={12} count={product._count?.reviews} />
          <div className="flex items-center gap-2 mt-2">
            <span className="text-base font-bold text-midnight font-poppins">{formatPrice(product.price)}</span>
            {product.mrp > product.price && (
              <span className="text-xs text-gray-400 line-through">{formatPrice(product.mrp)}</span>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            className="mt-3 w-full bg-midnight hover:bg-gradient-accent text-white text-xs font-semibold py-2 rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed group-hover:bg-gradient-accent"
          >
            <ShoppingCart size={13} />
            {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </Link>
    </motion.div>
  );
};
