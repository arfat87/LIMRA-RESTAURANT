import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronRight, Camera, Layers, Focus, Package, Zap, Repeat } from 'lucide-react';
import { categoryApi } from '../../api/category.api';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { ROUTES } from '../../constants/routes';
import type { Category } from '../../types/product.types';

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  default: Camera,
  'dslr-cameras': Camera,
  'mirrorless': Layers,
  'lenses': Focus,
  'accessories': Package,
  'action-cameras': Zap,
  'second-hand': Repeat,
};

const CATEGORY_COLORS = [
  'from-violet-600 to-purple-700',
  'from-blue-600 to-indigo-700',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-blue-600',
];

export const CategoryStrip: React.FC = () => {
  const { data } = useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: () => categoryApi.getAll().then((r) => r.data.data || []),
    staleTime: 10 * 60 * 1000,
  });

  const categories: Category[] = data || [];

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-poppins font-bold text-2xl text-midnight">Shop by Category</h2>
          <p className="text-gray-500 text-sm mt-0.5">Find exactly what you're looking for</p>
        </div>
        <Link to={ROUTES.SHOP} className="flex items-center gap-1 text-accent text-sm font-semibold hover:underline">
          View All <ChevronRight size={16} />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat, i) => {
          const Icon = CATEGORY_ICONS[cat.slug] || CATEGORY_ICONS.default;
          const gradient = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
          return (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ scale: 1.04, y: -3 }}
            >
              <Link
                to={`${ROUTES.SHOP}?category=${cat.slug}`}
                className="flex-shrink-0 flex flex-col items-center gap-2.5 group"
              >
                <div className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br ${gradient} rounded-2xl flex items-center justify-center shadow-md group-hover:shadow-xl transition-shadow`}>
                  <Icon size={28} className="text-white" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-700 group-hover:text-accent transition-colors text-center max-w-[80px] leading-tight">
                  {cat.name}
                </span>
                {cat._count && (
                  <span className="text-[10px] text-gray-400">{cat._count.products} items</span>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
