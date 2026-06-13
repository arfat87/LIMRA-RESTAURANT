import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Package, MapPin, CreditCard, Truck, User, Phone, Mail, CheckCircle } from 'lucide-react';
import { adminOrderApi } from '../../api/admin.api';
import { ROUTES } from '../../constants/routes';
import { Button } from '../../components/ui/Button';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { formatPrice } from '../../utils/formatCurrency';
import { formatDateOnly } from '../../utils/formatDate';
import toast from 'react-hot-toast';
import type { OrderStatus } from '../../types/order.types';

const STATUS_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending', CONFIRMED: 'Confirmed', PROCESSING: 'Processing',
  SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
};

const AdminOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [trackingId, setTrackingId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['admin-order', id],
    queryFn: () => adminOrderApi.getById(id!).then((r) => r.data.data),
    enabled: !!id,
  });

  const order = orderData as {
    id: string; status: OrderStatus; totalAmount: number; createdAt: string;
    paymentStatus: string; paymentMethod: string; trackingId?: string;
    address: { fullName: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string };
    user?: { name: string; email: string; phone: string };
    items: Array<{ id: string; quantity: number; price: number; product: { name: string; images: string[]; slug: string } }>;
  } | undefined;

  const updateMutation = useMutation({
    mutationFn: () => adminOrderApi.updateStatus(id!, selectedStatus as OrderStatus, trackingId || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] });
      qc.invalidateQueries({ queryKey: ['ADMIN_ALL_ORDERS'] });
      toast.success('Order status updated!');
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Sync local state when order loads (only on first load, not on every re-render)
  React.useEffect(() => {
    if (order && !selectedStatus) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedStatus(order.status);
    }
    if (order && order.trackingId && !trackingId) {
      setTrackingId(order.trackingId);
    }
  }, [order?.status, order?.trackingId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-100 rounded-xl w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-40 bg-white rounded-2xl shadow-card" />)}
          </div>
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-40 bg-white rounded-2xl shadow-card" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!order) return (
    <div className="text-center py-20">
      <p className="text-gray-500">Order not found</p>
      <Button onClick={() => navigate(ROUTES.ADMIN_ORDERS)} className="mt-4">Back to Orders</Button>
    </div>
  );

  return (
    <>
      <Helmet><title>Order #{id?.slice(-8).toUpperCase()} | Admin | DSLR WORLD</title></Helmet>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(ROUTES.ADMIN_ORDERS)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-poppins font-bold text-2xl text-midnight">
                Order #{order.id.slice(-8).toUpperCase()}
              </h1>
              <OrderStatusBadge status={order.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">Placed on {formatDateOnly(order.createdAt)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Items + Address */}
          <div className="lg:col-span-2 space-y-5">
            {/* Order Items */}
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                <Package size={18} className="text-accent" />
                <h2 className="font-poppins font-semibold text-gray-800">Order Items ({order.items.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 p-4">
                    <img
                      src={item.product.images[0] || '/placeholder-camera.jpg'}
                      alt={item.product.name}
                      className="w-16 h-16 object-cover rounded-xl flex-shrink-0 border border-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 line-clamp-1">{item.product.name}</p>
                      <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-midnight">{formatPrice(item.price * item.quantity)}</p>
                      <p className="text-xs text-gray-400">{formatPrice(item.price)} each</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="font-poppins font-semibold text-gray-700">Total Amount</span>
                  <span className="font-poppins font-black text-xl text-midnight">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <MapPin size={18} className="text-accent" />
                <h2 className="font-poppins font-semibold text-gray-800">Delivery Address</h2>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <p className="font-semibold text-gray-800">{order.address.fullName}</p>
                <p>{order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ''}</p>
                <p>{order.address.city}, {order.address.state} — {order.address.pincode}</p>
                <p className="flex items-center gap-1.5 mt-2">
                  <Phone size={13} className="text-gray-400" /> {order.address.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Right: Status Update + Customer + Payment */}
          <div className="space-y-5">
            {/* Update Status */}
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Truck size={18} className="text-accent" />
                <h2 className="font-poppins font-semibold text-gray-800">Update Status</h2>
              </div>
              <div className="space-y-3">
                {STATUS_FLOW.map((s) => (
                  <label key={s} className={`flex items-center gap-2.5 p-2.5 rounded-xl cursor-pointer transition-all ${
                    selectedStatus === s ? 'bg-accent/10 border border-accent/30' : 'hover:bg-gray-50 border border-transparent'
                  }`}>
                    <input type="radio" name="status" value={s}
                      checked={selectedStatus === s}
                      onChange={() => setSelectedStatus(s)}
                      className="accent-accent"
                    />
                    <span className="text-sm text-gray-700">{STATUS_LABELS[s]}</span>
                    {order.status === s && <CheckCircle size={14} className="text-emerald-500 ml-auto" />}
                  </label>
                ))}
              </div>

              {(selectedStatus === 'SHIPPED' || selectedStatus === 'DELIVERED') && (
                <div className="mt-3">
                  <label className="text-xs font-medium text-gray-600 mb-1 block">Tracking ID (optional)</label>
                  <input
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                    placeholder="e.g. Shiprocket AWB number"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all"
                  />
                </div>
              )}

              <Button
                fullWidth
                className="mt-4"
                loading={updateMutation.isPending}
                disabled={!selectedStatus || (selectedStatus === order?.status && !trackingId)}
                onClick={() => { if (selectedStatus) updateMutation.mutate(); }}
              >
                Save Status
              </Button>
            </div>

            {/* Customer Info */}
            {order.user && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <User size={18} className="text-accent" />
                  <h2 className="font-poppins font-semibold text-gray-800">Customer</h2>
                </div>
                <div className="space-y-2 text-sm">
                  <p className="font-semibold text-gray-800">{order.user.name}</p>
                  <p className="flex items-center gap-1.5 text-gray-600">
                    <Mail size={13} className="text-gray-400" /> {order.user.email}
                  </p>
                  <p className="flex items-center gap-1.5 text-gray-600">
                    <Phone size={13} className="text-gray-400" /> {order.user.phone}
                  </p>
                </div>
              </div>
            )}

            {/* Payment Info */}
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard size={18} className="text-accent" />
                <h2 className="font-poppins font-semibold text-gray-800">Payment</h2>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span className="font-medium text-gray-800">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`font-semibold ${order.paymentStatus === 'PAID' ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {order.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total</span>
                  <span className="font-black text-midnight">{formatPrice(order.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminOrderDetail;
