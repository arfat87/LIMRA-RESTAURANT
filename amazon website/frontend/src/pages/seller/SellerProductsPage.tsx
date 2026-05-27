import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Plus, Edit, Trash2, Eye, Package } from 'lucide-react'
import { mockProducts } from '@/data/mockData'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  draft: 'bg-gray-500/20 text-gray-400',
  inactive: 'bg-red-500/20 text-red-400',
  out_of_stock: 'bg-yellow-500/20 text-yellow-400',
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState(mockProducts)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const filtered = products.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || p.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id))
    toast.success('Product deleted', { style: { background: '#1F2937', color: '#fff' } })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">My Products</h1>
          <p className="text-gray-400">{filtered.length} products found</p>
        </div>
        <Link to="/seller/products/add" className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Product
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="input pl-9" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Product</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Price</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Stock</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Status</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Rating</th>
                <th className="py-3 px-4 text-left text-xs text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(product => (
                <motion.tr
                  key={product.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-surface/50 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.images?.[0]?.url}
                        alt={product.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                      <div>
                        <p className="text-sm font-medium text-white line-clamp-1 max-w-[180px]">{product.title}</p>
                        <p className="text-xs text-gray-500">{product.category?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm font-bold text-primary">${product.price.toFixed(2)}</span>
                    {product.compare_price && (
                      <p className="text-xs text-gray-500 line-through">${product.compare_price.toFixed(2)}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-sm font-medium ${product.stock_quantity <= product.low_stock_threshold ? 'text-yellow-400' : 'text-white'}`}>
                      {product.stock_quantity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge text-xs ${STATUS_BADGE[product.status] || 'text-gray-400'}`}>
                      {product.status.charAt(0).toUpperCase() + product.status.slice(1).replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-accent">★ {product.avg_rating}</span>
                    <p className="text-xs text-gray-500">({product.review_count})</p>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Link to={`/product/${product.id}`} className="p-1.5 hover:bg-surface rounded transition-colors text-gray-400 hover:text-white">
                        <Eye size={15} />
                      </Link>
                      <Link to={`/seller/products/${product.id}/edit`} className="p-1.5 hover:bg-surface rounded transition-colors text-gray-400 hover:text-primary">
                        <Edit size={15} />
                      </Link>
                      <button onClick={() => handleDelete(product.id)} className="p-1.5 hover:bg-red-500/10 rounded transition-colors text-gray-400 hover:text-red-400">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Package size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No products found</p>
          </div>
        )}
      </div>
    </div>
  )
}
