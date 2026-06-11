import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Package, MapPin, CreditCard, Truck } from 'lucide-react';
import { orderApi } from '../api/order.api';
import { QUERY_KEYS } from '../constants/queryKeys';
import { formatPrice } from '../utils/formatCurrency';
import { formatDate } from '../utils/formatDate';
import { OrderStatusBadge, PaymentStatusBadge } from '../components/ui/Badge';
import { PageSpinner } from '../components/ui/Spinner';
import { ROUTES } from '../constants/routes';

const ORDER_TIMELINE = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const { data: order, isLoading } = useQuery({
    queryKey: QUERY_KEYS.ORDER(id!),
    queryFn: () => orderApi.getOrder(id!).then((r) => r.data.data!),
    enabled: !!id,
  });

  if (isLoading) return <PageSpinner />;
  if (!order) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <Package size={48} className="text-gray-300 mx-auto mb-4" />
      <p className="font-poppins font-bold text-xl text-gray-700">Order not found</p>
      <Link to={ROUTES.ORDERS} className="text-accent mt-4 inline-block hover:underline">← Back to Orders</Link>
    </div>
  );

  const currentStep = ORDER_TIMELINE.indexOf(order.status);

  return (
    <>
      <Helmet><title>Order #{order.id.slice(-8).toUpperCase()} | DSLR WORLD</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={ROUTES.ORDERS} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="font-poppins font-bold text-xl text-midnight">
              Order #{order.id.slice(-8).toUpperCase()}
            </h1>
            <p className="text-gray-500 text-sm">{formatDate(order.createdAt)}</p>
          </div>
          <div className="ml-auto flex gap-2">
            <OrderStatusBadge status={order.status} />
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>
        </div>

        {/* Order Timeline */}
        {!['CANCELLED', 'RETURNED'].includes(order.status) && (
          <div className="bg-white rounded-2xl shadow-card p-5 mb-4">
            <h2 className="font-poppins font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Truck size={18} className="text-accent" />Order Progress
            </h2>
            <div className="flex items-center">
              {ORDER_TIMELINE.map((step, i) => (
                <React.Fragment key={step}>
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      i <= currentStep ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                      {i < currentStep ? '✓' : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1 font-medium text-center max-w-[60px] ${
                      i <= currentStep ? 'text-accent' : 'text-gray-400'
                    }`}>
                      {step.charAt(0) + step.slice(1).toLowerCase()}
                    </span>
                  </div>
                  {i < ORDER_TIMELINE.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-all ${i < currentStep ? 'bg-accent' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            {order.trackingId && (
              <div className="mt-3 bg-blue-50 rounded-xl px-3 py-2 text-sm text-blue-700">
                🚚 Tracking ID: <span className="font-mono font-bold">{order.trackingId}</span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Delivery Address */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-poppins font-bold text-gray-800 mb-3 flex items-center gap-2">
              <MapPin size={16} className="text-accent" />Delivery Address
            </h2>
            <p className="font-semibold text-gray-700">{order.address.fullName}</p>
            <p className="text-sm text-gray-600 mt-1">{order.address.line1}</p>
            {order.address.line2 && <p className="text-sm text-gray-600">{order.address.line2}</p>}
            <p className="text-sm text-gray-600">{order.address.city}, {order.address.state} {order.address.pincode}</p>
            <p className="text-sm text-gray-500 mt-1">📞 {order.address.phone}</p>
          </div>

          {/* Payment Info */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h2 className="font-poppins font-bold text-gray-800 mb-3 flex items-center gap-2">
              <CreditCard size={16} className="text-accent" />Payment
            </h2>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Method</span>
                <span className="font-medium text-gray-800">{order.paymentMethod || 'Razorpay'}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Status</span>
                <PaymentStatusBadge status={order.paymentStatus} />
              </div>
              {order.razorpayPaymentId && (
                <div className="flex justify-between text-gray-600">
                  <span>Payment ID</span>
                  <span className="font-mono text-xs">{order.razorpayPaymentId.slice(-10)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-4">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-poppins font-bold text-gray-800">Order Items</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {order.items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4">
                <Link to={ROUTES.PRODUCT(item.product.slug)}>
                  <img src={item.product.images[0]} alt={item.product.name}
                    className="w-16 h-16 object-cover rounded-xl border border-gray-100 flex-shrink-0" />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={ROUTES.PRODUCT(item.product.slug)}>
                    <p className="font-semibold text-gray-800 hover:text-accent transition-colors line-clamp-1">
                      {item.product.name}
                    </p>
                  </Link>
                  <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                </div>
                <p className="font-bold text-midnight">{formatPrice(item.price * item.quantity)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h2 className="font-poppins font-bold text-gray-800 mb-4">Price Details</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatPrice(order.totalAmount - order.shippingCharge + order.couponDiscount)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Shipping</span>
              <span className={order.shippingCharge === 0 ? 'text-emerald-600 font-bold' : ''}>
                {order.shippingCharge === 0 ? 'FREE' : formatPrice(order.shippingCharge)}
              </span>
            </div>
            {order.couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Coupon Discount</span>
                <span>- {formatPrice(order.couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-midnight text-base pt-2 border-t border-gray-100">
              <span>Total Paid</span>
              <span>{formatPrice(order.totalAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default OrderDetail;
