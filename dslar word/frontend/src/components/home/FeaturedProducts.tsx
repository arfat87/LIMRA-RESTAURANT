import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { productApi } from '../../api/product.api';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { ROUTES } from '../../constants/routes';
import { ProductGrid } from '../product/ProductGrid';

export const FeaturedProducts: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.FEATURED_PRODUCTS],
    queryFn: () => productApi.getFeatured().then((r) => r.data.data || []),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-poppins font-bold text-2xl text-midnight">Featured Products</h2>
          <p className="text-gray-500 text-sm mt-0.5">Handpicked deals — updated daily</p>
        </div>
        <Link to={ROUTES.SHOP} className="flex items-center gap-1 text-accent text-sm font-semibold hover:underline">
          View All <ChevronRight size={16} />
        </Link>
      </div>
      <ProductGrid products={data?.slice(0, 8)} isLoading={isLoading} skeletonCount={8} />
    </section>
  );
};
