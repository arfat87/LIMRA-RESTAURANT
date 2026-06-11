import mongoose from 'mongoose';

// ============================================================
// Order Model — DSLR WORLD
// ============================================================

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED';
export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'FAILED';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number; // price at time of order in paise
}

export interface IOrder {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  addressId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  shiprocketOrderId?: string;
  trackingId?: string;
  totalAmount: number;  // paise
  shippingCharge: number;
  couponDiscount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new mongoose.Schema<IOrderItem>(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:  { type: Number, required: true, min: 1 },
    price:     { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema<IOrder>(
  {
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    addressId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Address', required: true },
    items:              [orderItemSchema],
    status:             { type: String, enum: ['PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURNED'], default: 'PENDING' },
    paymentStatus:      { type: String, enum: ['UNPAID','PAID','REFUNDED','FAILED'], default: 'UNPAID' },
    paymentMethod:      { type: String },
    razorpayOrderId:    { type: String },
    razorpayPaymentId:  { type: String },
    razorpaySignature:  { type: String },
    shiprocketOrderId:  { type: String },
    trackingId:         { type: String },
    totalAmount:        { type: Number, required: true },
    shippingCharge:     { type: Number, default: 0 },
    couponDiscount:     { type: Number, default: 0 },
    notes:              { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1 });
orderSchema.index({ razorpayOrderId: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
