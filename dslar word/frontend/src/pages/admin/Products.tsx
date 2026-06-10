import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, ToggleLeft, ToggleRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { formatPrice } from '../../utils/formatCurrency';
import { ConditionBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { ROUTES } from '../../constants/routes';
import api from '../../api/axios';
import type { Product } from '../../types/product.types';
import toast from 'react-hot-toast';

const AdminProducts: React.FC = () => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.PRODUCTS, { page, search }],
    queryFn: () => api.get('/products', { params: { page, limit: 15, q: search || undefined } }).then((r) => r.data.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.PRODUCTS] });
      toast.success('Product deactivated');
    },
  });

  const products: Product[] = data?.products || [];
  const pagination = data?.pagination;

  return (
    <>
      <Helmet><title>Products | Admin | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-poppins font-bold text-2xl text-midnight">Products</h1>
          <Link to={ROUTES.ADMIN_ADD_PRODUCT}>
            <Button leftIcon={<Plus size={16} />}>Add Product</Button>
          </Link>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-accent outline-none"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Product', 'Condition', 'Price', 'Stock', 'Active', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 font-poppins text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                  ))
                ) : products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.images[0]} alt={p.name} className="w-10 h-10 object-cover rounded-lg flex-shrink-0 border border-gray-100" />
                        <div>
                          <p className="font-medium text-gray-800 line-clamp-1 max-w-xs">{p.name}</p>
                          {p.brand && <p className="text-xs text-gray-400">{p.brand}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ConditionBadge condition={p.condition} /></td>
                    <td className="px-4 py-3 font-semibold text-midnight">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">
                      <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-700' : p.stock <= 5 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.isActive ? <ToggleRight className="text-emerald-500" size={22} /> : <ToggleLeft className="text-gray-400" size={22} />}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link to={ROUTES.ADMIN_EDIT_PRODUCT(p.id)}>
                          <button className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                        </Link>
                        <button
                          onClick={() => { if (confirm('Deactivate this product?')) deleteMutation.mutate(p.id); }}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {pagination && (
          <Pagination page={page} totalPages={pagination.totalPages} hasNext={pagination.hasNext} hasPrev={pagination.hasPrev} onPageChange={setPage} />
        )}
      </div>
    </>
  );
};

export default AdminProducts;
