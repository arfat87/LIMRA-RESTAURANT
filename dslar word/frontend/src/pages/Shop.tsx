import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { productApi } from '../api/product.api';
import { categoryApi } from '../api/category.api';
import { QUERY_KEYS } from '../constants/queryKeys';
import type { ProductQuery } from '../types/product.types';
import { ProductGrid } from '../components/product/ProductGrid';
import { ProductFilters } from '../components/product/ProductFilters';
import { Pagination } from '../components/ui/Pagination';

const SORT_OPTIONS = [
  { value: '', label: 'Featured' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Top Rated' },
];

const Shop: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState<ProductQuery>({
    page: 1,
    limit: 12,
    category: searchParams.get('category') || undefined,
    condition: (searchParams.get('condition') as ProductQuery['condition']) || undefined,
    q: searchParams.get('q') || undefined,
  });

  const { data: categoriesData } = useQuery({
    queryKey: [QUERY_KEYS.CATEGORIES],
    queryFn: () => categoryApi.getAll().then((r) => r.data.data || []),
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.PRODUCTS, filters],
    queryFn: () => productApi.getProducts(filters).then((r) => r.data.data),
    staleTime: 2 * 60 * 1000,
  });

  const products = data?.products || [];
  const pagination = data?.pagination;

  const updateFilter = (updates: ProductQuery) => setFilters({ ...filters, ...updates, page: 1 });

  return (
    <>
      <Helmet>
        <title>Shop Cameras & Accessories | DSLR WORLD</title>
        <meta name="description" content="Browse 500+ cameras, lenses, and accessories. Filter by condition, brand, price. New & second-hand DSLRs at lowest prices." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="font-poppins font-bold text-2xl text-midnight mb-1">
            {filters.q ? `Search: "${filters.q}"` : 'All Products'}
          </h1>
          {pagination && (
            <p className="text-gray-500 text-sm">
              Showing {((filters.page! - 1) * filters.limit!) + 1}–{Math.min(filters.page! * filters.limit!, pagination.total)} of {pagination.total.toLocaleString('en-IN')} results
            </p>
          )}
        </div>

        <div className="flex gap-6">
          {/* Sidebar filters */}
          <ProductFilters
            filters={filters}
            onChange={setFilters}
            categories={categoriesData || []}
          />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Sort bar */}
            <div className="flex items-center justify-between mb-5 bg-white rounded-xl shadow-card px-4 py-2.5">
              <div className="flex items-center gap-2 lg:hidden">
                <ProductFilters
                  filters={filters}
                  onChange={setFilters}
                  categories={categoriesData || []}
                />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <ArrowUpDown size={15} className="text-gray-400" />
                <select
                  value={filters.sort || ''}
                  onChange={(e) => updateFilter({ sort: e.target.value as ProductQuery['sort'] })}
                  className="text-sm border-0 outline-none text-gray-700 bg-transparent font-medium cursor-pointer"
                >
                  {SORT_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <ProductGrid products={products} isLoading={isLoading} />

            {pagination && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
                onPageChange={(p) => setFilters({ ...filters, page: p })}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Shop;
