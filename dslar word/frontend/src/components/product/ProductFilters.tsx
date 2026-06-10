import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import type { ProductQuery, Condition } from '../../types/product.types';
import { Button } from '../ui/Button';

interface ProductFiltersProps {
  filters: ProductQuery;
  onChange: (filters: ProductQuery) => void;
  categories?: { id: string; name: string; slug: string }[];
}

const BRANDS = ['Canon', 'Nikon', 'Sony', 'Fujifilm', 'GoPro', 'Olympus', 'Panasonic'];
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'NEW', label: 'New' },
  { value: 'SECOND_HAND', label: 'Second Hand' },
  { value: 'REFURBISHED', label: 'Refurbished' },
];

export const ProductFilters: React.FC<ProductFiltersProps> = ({ filters, onChange, categories = [] }) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const update = (key: keyof ProductQuery, value: unknown) => {
    onChange({ ...filters, [key]: value, page: 1 });
  };

  const clearAll = () => onChange({ page: 1, limit: 12 });

  const hasFilters = !!(filters.category || filters.condition || filters.brand || filters.minPrice || filters.maxPrice);

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Clear all */}
      {hasFilters && (
        <button onClick={clearAll} className="flex items-center gap-1 text-accent text-sm font-semibold hover:underline">
          <X size={14} />Clear All Filters
        </button>
      )}

      {/* Category */}
      <FilterSection title="Category">
        <div className="space-y-2">
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="category"
                value={cat.slug}
                checked={filters.category === cat.slug}
                onChange={() => update('category', cat.slug)}
                className="accent-accent"
              />
              <span className="text-sm text-gray-600 group-hover:text-midnight">{cat.name}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Condition */}
      <FilterSection title="Condition">
        <div className="space-y-2">
          {CONDITIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="condition"
                value={value}
                checked={filters.condition === value}
                onChange={() => update('condition', value)}
                className="accent-accent"
              />
              <span className="text-sm text-gray-600 group-hover:text-midnight">{label}</span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Price Range */}
      <FilterSection title="Price Range">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min ₹"
              value={filters.minPrice ? filters.minPrice / 100 : ''}
              onChange={(e) => update('minPrice', e.target.value ? Number(e.target.value) * 100 : undefined)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-accent outline-none"
            />
            <input
              type="number"
              placeholder="Max ₹"
              value={filters.maxPrice ? filters.maxPrice / 100 : ''}
              onChange={(e) => update('maxPrice', e.target.value ? Number(e.target.value) * 100 : undefined)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-accent outline-none"
            />
          </div>
        </div>
      </FilterSection>

      {/* Brand */}
      <FilterSection title="Brand">
        <div className="space-y-2">
          {BRANDS.map((brand) => (
            <label key={brand} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="brand"
                value={brand}
                checked={filters.brand === brand}
                onChange={() => update('brand', brand)}
                className="accent-accent"
              />
              <span className="text-sm text-gray-600 group-hover:text-midnight">{brand}</span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-56 flex-shrink-0">
        <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-poppins font-semibold text-gray-800 flex items-center gap-2">
              <SlidersHorizontal size={16} className="text-accent" />Filters
            </h3>
          </div>
          <FiltersContent />
        </div>
      </div>

      {/* Mobile filter button */}
      <div className="lg:hidden">
        <Button variant="outline" size="sm" onClick={() => setMobileOpen(true)} leftIcon={<SlidersHorizontal size={15} />}>
          Filters {hasFilters && <span className="bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">!</span>}
        </Button>
      </div>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/60" />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
                <h3 className="font-poppins font-bold text-midnight">Filters</h3>
                <button onClick={() => setMobileOpen(false)}><X size={20} className="text-gray-500" /></button>
              </div>
              <div className="p-5"><FiltersContent /></div>
              <div className="p-5 border-t sticky bottom-0 bg-white">
                <Button fullWidth onClick={() => setMobileOpen(false)}>Apply Filters</Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
      <button onClick={() => setOpen(!open)} className="flex items-center justify-between w-full mb-3">
        <h4 className="font-poppins font-semibold text-gray-700 text-sm">{title}</h4>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>{open && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          {children}
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
};
