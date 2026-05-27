import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SlidersHorizontal, Grid3X3, List, X, ChevronDown, Star } from 'lucide-react'
import ProductCard from '@/components/cards/ProductCard'
import SkeletonCard from '@/components/ui/SkeletonCard'
import { mockProducts, mockCategories } from '@/data/mockData'

const BRANDS = ['TechVault', 'StyleHub', 'Apple', 'Samsung', 'Nike', 'Sony']
const SORT_OPTIONS = [
  { value: 'relevance', label: 'Most Relevant' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'rating', label: 'Best Rating' },
  { value: 'newest', label: 'Newest First' },
  { value: 'popular', label: 'Most Popular' },
]

export default function ProductListingPage() {
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState('relevance')
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 2000])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedBrands, setSelectedBrands] = useState<string[]>([])
  const [minRating, setMinRating] = useState(0)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loading] = useState(false)

  const PER_PAGE = 12

  const filteredProducts = useMemo(() => {
    let products = [...mockProducts]

    // Filter by search query
    const q = searchParams.get('q')
    if (q) products = products.filter(p => p.title.toLowerCase().includes(q.toLowerCase()))

    // Filter by category
    if (selectedCategories.length > 0) {
      products = products.filter(p => selectedCategories.includes(p.category_id))
    }

    // Filter by price
    products = products.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1])

    // Filter by rating
    if (minRating > 0) products = products.filter(p => p.avg_rating >= minRating)

    // Filter by brand
    if (selectedBrands.length > 0) {
      products = products.filter(p => selectedBrands.includes(p.seller?.business_name ?? ''))
    }

    // Filter in stock
    if (inStockOnly) products = products.filter(p => p.stock_quantity > 0)

    // Sort
    switch (sort) {
      case 'price_asc': products.sort((a, b) => a.price - b.price); break
      case 'price_desc': products.sort((a, b) => b.price - a.price); break
      case 'rating': products.sort((a, b) => b.avg_rating - a.avg_rating); break
      case 'newest': products.sort((a, b) => b.created_at.localeCompare(a.created_at)); break
      case 'popular': products.sort((a, b) => b.review_count - a.review_count); break
    }

    return products
  }, [searchParams, selectedCategories, selectedBrands, priceRange, minRating, inStockOnly, sort])

  const paginatedProducts = filteredProducts.slice(0, page * PER_PAGE)
  const hasMore = paginatedProducts.length < filteredProducts.length

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
    setPage(1)
  }

  const toggleBrand = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand]
    )
    setPage(1)
  }

  const clearFilters = () => {
    setSelectedCategories([])
    setSelectedBrands([])
    setPriceRange([0, 2000])
    setMinRating(0)
    setInStockOnly(false)
    setSort('relevance')
    setPage(1)
  }

  const activeFilterCount = selectedCategories.length + selectedBrands.length +
    (minRating > 0 ? 1 : 0) + (inStockOnly ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 2000 ? 1 : 0)

  const Sidebar = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <SlidersHorizontal size={18} className="text-primary" />
          Filters
          {activeFilterCount > 0 && (
            <span className="badge bg-primary text-secondary ml-1">{activeFilterCount}</span>
          )}
        </h3>
        {activeFilterCount > 0 && (
          <button onClick={clearFilters} className="text-xs text-primary hover:text-primary-400 transition-colors">
            Clear All
          </button>
        )}
      </div>

      {/* Categories */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Category</h4>
        <div className="space-y-2">
          {mockCategories.map(cat => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedCategories.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                className="accent-primary rounded w-4 h-4"
              />
              <span className="text-sm text-gray-400 group-hover:text-white transition-colors">
                {cat.icon} {cat.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Price Range</h4>
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="number"
              value={priceRange[0]}
              onChange={e => setPriceRange([Number(e.target.value), priceRange[1]])}
              className="input text-sm py-1.5"
              placeholder="Min"
              min={0}
            />
            <input
              type="number"
              value={priceRange[1]}
              onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
              className="input text-sm py-1.5"
              placeholder="Max"
              max={10000}
            />
          </div>
          <input
            type="range"
            min={0}
            max={2000}
            value={priceRange[1]}
            onChange={e => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Min Rating</h4>
        <div className="space-y-2">
          {[4, 3, 2, 1].map(r => (
            <label key={r} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="rating"
                checked={minRating === r}
                onChange={() => setMinRating(r === minRating ? 0 : r)}
                className="accent-primary w-4 h-4"
              />
              <div className="flex items-center gap-1">
                {[...Array(r)].map((_, i) => (
                  <Star key={i} size={12} className="fill-accent text-accent" />
                ))}
                {[...Array(5 - r)].map((_, i) => (
                  <Star key={i} size={12} className="text-gray-600" />
                ))}
                <span className="text-xs text-gray-400 ml-1">& Up</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Brands */}
      <div>
        <h4 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">Brand</h4>
        <div className="space-y-2">
          {BRANDS.map(brand => (
            <label key={brand} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedBrands.includes(brand)}
                onChange={() => toggleBrand(brand)}
                className="accent-primary rounded w-4 h-4"
              />
              <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{brand}</span>
            </label>
          ))}
        </div>
      </div>

      {/* In Stock */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={e => setInStockOnly(e.target.checked)}
            className="accent-primary rounded w-4 h-4"
          />
          <span className="text-sm text-gray-400 group-hover:text-white transition-colors font-medium">
            In Stock Only
          </span>
        </label>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex gap-6">
        {/* Sidebar desktop */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="card sticky top-24">
            <Sidebar />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed left-0 top-0 bottom-0 w-80 bg-[#1F2937] border-r border-border shadow-2xl z-50 p-4 overflow-y-auto lg:hidden"
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-white text-lg">Filters</h3>
                  <button onClick={() => setSidebarOpen(false)}>
                    <X size={20} className="text-gray-400" />
                  </button>
                </div>
                <Sidebar />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden btn-secondary flex items-center gap-2 text-sm py-2"
              >
                <SlidersHorizontal size={16} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="badge bg-primary text-secondary">{activeFilterCount}</span>
                )}
              </button>
              <p className="text-sm text-gray-400">
                <span className="font-semibold text-white">{filteredProducts.length}</span> results
                {searchParams.get('q') && (
                  <span> for "<span className="text-primary">{searchParams.get('q')}</span>"</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort */}
              <div className="relative">
                <select
                  value={sort}
                  onChange={e => { setSort(e.target.value); setPage(1) }}
                  className="input text-sm py-2 pr-8 appearance-none cursor-pointer"
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>

              {/* View toggle */}
              <div className="flex bg-surface border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 transition-colors ${view === 'grid' ? 'bg-primary text-secondary' : 'text-gray-400 hover:text-white'}`}
                >
                  <Grid3X3 size={16} />
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 transition-colors ${view === 'list' ? 'bg-primary text-secondary' : 'text-gray-400 hover:text-white'}`}
                >
                  <List size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Active filter chips */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {selectedCategories.map(id => {
                const cat = mockCategories.find(c => c.id === id)
                return cat ? (
                  <span key={id} className="flex items-center gap-1 badge bg-primary/20 text-primary border border-primary/30 px-2 py-1">
                    {cat.name}
                    <button onClick={() => toggleCategory(id)}><X size={12} /></button>
                  </span>
                ) : null
              })}
              {selectedBrands.map(brand => (
                <span key={brand} className="flex items-center gap-1 badge bg-primary/20 text-primary border border-primary/30 px-2 py-1">
                  {brand}
                  <button onClick={() => toggleBrand(brand)}><X size={12} /></button>
                </span>
              ))}
              {minRating > 0 && (
                <span className="flex items-center gap-1 badge bg-primary/20 text-primary border border-primary/30 px-2 py-1">
                  {minRating}+ Stars
                  <button onClick={() => setMinRating(0)}><X size={12} /></button>
                </span>
              )}
            </div>
          )}

          {/* Product grid / list */}
          {loading ? (
            <div className={view === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-4'
            }>
              {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold text-white mb-2">No products found</h3>
              <p className="text-gray-400 mb-6">Try adjusting your filters or search query</p>
              <button onClick={clearFilters} className="btn-primary">Clear All Filters</button>
            </div>
          ) : (
            <>
              <div className={view === 'grid'
                ? 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'space-y-4'
              }>
                <AnimatePresence>
                  {paginatedProducts.map(product => (
                    <ProductCard key={product.id} product={product} variant={view} />
                  ))}
                </AnimatePresence>
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="btn-outline flex items-center gap-2"
                  >
                    Load More Products
                    <ChevronDown size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
