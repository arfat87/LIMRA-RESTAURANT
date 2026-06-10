import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Package, Users, ShoppingCart, AlertTriangle } from 'lucide-react';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { formatPrice } from '../../utils/formatCurrency';
import { Skeleton } from '../../components/ui/Skeleton';
import api from '../../api/axios';

interface DashboardStats {
  revenue: { total: number };
  orders: { total: number; pending: number };
  products: { total: number };
  users: { total: number };
  lowStockProducts: Array<{ id: string; name: string; stock: number; slug: string }>;
}

const AdminDashboard: React.FC = () => {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: [QUERY_KEYS.ADMIN_DASHBOARD],
    queryFn: () => api.get('/admin/dashboard').then((r) => r.data.data),
  });

  const stats = [
    { label: 'Total Revenue', value: data ? formatPrice(data.revenue.total) : '-', icon: TrendingUp, color: 'from-emerald-500 to-teal-600' },
    { label: 'Total Orders', value: data?.orders.total || '-', icon: ShoppingCart, color: 'from-blue-500 to-indigo-600' },
    { label: 'Products', value: data?.products.total || '-', icon: Package, color: 'from-violet-500 to-purple-600' },
    { label: 'Customers', value: data?.users.total || '-', icon: Users, color: 'from-orange-500 to-amber-600' },
  ];

  return (
    <>
      <Helmet><title>Admin Dashboard | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        <div>
          <h1 className="font-poppins font-bold text-2xl text-midnight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">DSLR WORLD — Admin Overview</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-2xl shadow-card p-5">
              <div className={`w-11 h-11 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon size={20} className="text-white" />
              </div>
              {isLoading ? (
                <>
                  <Skeleton className="h-7 w-24 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </>
              ) : (
                <>
                  <p className="font-poppins font-black text-2xl text-midnight">{String(value)}</p>
                  <p className="text-gray-500 text-xs font-medium mt-0.5">{label}</p>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Pending orders alert */}
        {data && data.orders.pending > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
            <p className="text-amber-700 font-medium">
              {data.orders.pending} order{data.orders.pending > 1 ? 's' : ''} pending approval
            </p>
          </div>
        )}

        {/* Low Stock */}
        {data?.lowStockProducts && data.lowStockProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-poppins font-bold text-gray-800 mb-4 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />Low Stock Alert
            </h2>
            <div className="space-y-3">
              {data.lowStockProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <p className="text-sm text-gray-700 font-medium">{p.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.stock === 0 ? 'Out of Stock' : `${p.stock} left`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminDashboard;
