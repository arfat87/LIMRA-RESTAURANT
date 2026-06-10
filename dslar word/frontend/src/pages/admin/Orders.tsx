import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { QUERY_KEYS } from '../../constants/queryKeys';
import { formatPrice } from '../../utils/formatCurrency';
import { formatDateOnly } from '../../utils/formatDate';
import api from '../../api/axios';
import type { Order, OrderStatus } from '../../types/order.types';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const AdminOrders: React.FC = () => {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.ADMIN_ALL_ORDERS, page],
    queryFn: () => api.get('/admin/orders', { params: { page, limit: 15 } }).then((r) => r.data.data),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.put(`/admin/orders/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_ALL_ORDERS] });
      toast.success('Order status updated');
    },
  });

  const orders: Order[] = (data as { orders?: Order[] })?.orders || [];
  const pagination = (data as { pagination?: { page: number; totalPages: number; hasNext: boolean; hasPrev: boolean } })?.pagination;

  return (
    <>
      <Helmet><title>Orders | Admin | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        <h1 className="font-poppins font-bold text-2xl text-midnight">All Orders</h1>
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Order ID', 'Customer', 'Date', 'Amount', 'Status', 'Update Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-gray-600 font-poppins text-xs uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i}><td colSpan={6} className="px-4 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                  ))
                ) : orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">#{order.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[140px] truncate">User</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateOnly(order.createdAt)}</td>
                    <td className="px-4 py-3 font-bold text-midnight">{formatPrice(order.totalAmount)}</td>
                    <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                    <td className="px-4 py-3">
                      <select
                        value={order.status}
                        onChange={(e) => updateStatus.mutate({ id: order.id, status: e.target.value as OrderStatus })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:border-accent outline-none"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {pagination && <Pagination page={page} totalPages={pagination.totalPages} hasNext={pagination.hasNext} hasPrev={pagination.hasPrev} onPageChange={setPage} />}
      </div>
    </>
  );
};

export default AdminOrders;
