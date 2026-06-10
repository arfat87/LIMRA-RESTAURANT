import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, ChevronRight } from 'lucide-react';
import { orderApi } from '../api/order.api';
import { QUERY_KEYS } from '../constants/queryKeys';
import { formatPrice } from '../utils/formatCurrency';
import { formatDateOnly } from '../utils/formatDate';
import { OrderStatusBadge } from '../components/ui/Badge';
import { OrderCardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import type { Order } from '../types/order.types';

const OrderHistory: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEYS.ORDERS],
    queryFn: () => orderApi.getOrders().then((r) => r.data.data),
  });

  const orders: Order[] = (data as { orders?: Order[] })?.orders || [];

  return (
    <>
      <Helmet><title>My Orders | DSLR WORLD</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="font-poppins font-bold text-2xl text-midnight mb-6">My Orders</h1>
        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <OrderCardSkeleton key={i} />)}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <Package size={56} className="text-gray-300 mx-auto mb-4" />
            <h2 className="font-poppins font-bold text-xl text-gray-700 mb-2">No orders yet</h2>
            <p className="text-gray-500 mb-6">Your orders will appear here once you place them.</p>
            <Link to={ROUTES.SHOP}><Button>Start Shopping</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Order ID</p>
                    <p className="font-mono text-sm font-semibold text-gray-700">#{order.id.slice(-8).toUpperCase()}</p>
                  </div>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-gray-400 mb-3">{formatDateOnly(order.createdAt)}</p>
                <div className="flex gap-2 overflow-x-auto mb-4">
                  {order.items.slice(0, 3).map((item) => (
                    <img key={item.id} src={item.product.images[0]} alt={item.product.name}
                      className="w-14 h-14 object-cover rounded-xl border border-gray-100 flex-shrink-0" />
                  ))}
                  {order.items.length > 3 && (
                    <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                      +{order.items.length - 3}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-400">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
                    <p className="font-bold text-midnight font-poppins">{formatPrice(order.totalAmount)}</p>
                  </div>
                  <Link to={ROUTES.ORDER_DETAIL(order.id)}>
                    <Button variant="outline" size="sm" rightIcon={<ChevronRight size={14} />}>View Details</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default OrderHistory;
