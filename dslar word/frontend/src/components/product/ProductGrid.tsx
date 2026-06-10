import React from 'react';
import type { Product } from '../../types/product.types';
import { ProductCard } from './ProductCard';
import { ProductGridSkeleton } from '../ui/Skeleton';

interface ProductGridProps {
  products?: Product[];
  isLoading?: boolean;
  skeletonCount?: number;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ products, isLoading, skeletonCount = 8 }) => {
  if (isLoading) return <ProductGridSkeleton count={skeletonCount} />;
  if (!products?.length) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-6xl mb-4">📷</div>
      <h3 className="text-xl font-semibold text-gray-700 font-poppins mb-2">No products found</h3>
      <p className="text-gray-500 text-sm">Try adjusting your filters or search terms</p>
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
};
