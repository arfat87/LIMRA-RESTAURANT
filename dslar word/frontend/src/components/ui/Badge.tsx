import React from 'react';
import type { Condition } from '../../types/product.types';
import type { OrderStatus, PaymentStatus } from '../../types/order.types';

// Condition Badge
const conditionConfig: Record<Condition, { label: string; className: string }> = {
  NEW: { label: 'New', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  SECOND_HAND: { label: 'Second Hand', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  REFURBISHED: { label: 'Refurbished', className: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export const ConditionBadge: React.FC<{ condition: Condition }> = ({ condition }) => {
  const { label, className } = conditionConfig[condition] || conditionConfig.NEW;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full border font-poppins ${className}`}>
      {label}
    </span>
  );
};

// Order Status Badge
const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  CONFIRMED: { label: 'Confirmed', className: 'bg-blue-100 text-blue-700' },
  PROCESSING: { label: 'Processing', className: 'bg-purple-100 text-purple-700' },
  SHIPPED: { label: 'Shipped', className: 'bg-indigo-100 text-indigo-700' },
  DELIVERED: { label: 'Delivered', className: 'bg-emerald-100 text-emerald-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-red-100 text-red-700' },
  RETURNED: { label: 'Returned', className: 'bg-gray-100 text-gray-700' },
};

export const OrderStatusBadge: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const { label, className } = orderStatusConfig[status] || orderStatusConfig.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full font-poppins ${className}`}>
      {label}
    </span>
  );
};

// Payment Status Badge
const paymentConfig: Record<PaymentStatus, { label: string; className: string }> = {
  UNPAID: { label: 'Unpaid', className: 'bg-yellow-100 text-yellow-700' },
  PAID: { label: 'Paid', className: 'bg-emerald-100 text-emerald-700' },
  REFUNDED: { label: 'Refunded', className: 'bg-blue-100 text-blue-700' },
  FAILED: { label: 'Failed', className: 'bg-red-100 text-red-700' },
};

export const PaymentStatusBadge: React.FC<{ status: PaymentStatus }> = ({ status }) => {
  const { label, className } = paymentConfig[status] || paymentConfig.UNPAID;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full font-poppins ${className}`}>
      {label}
    </span>
  );
};
