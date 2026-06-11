import mongoose from 'mongoose';
import { Order } from '../../models/Order.model';
import { Cart } from '../../models/Cart.model';
import { Address } from '../../models/Address.model';
import { Product } from '../../models/Product.model';
import { User } from '../../models/User.model';
import { ApiError } from '../../utils/ApiError';
import { clearCart } from '../cart/cart.service';
import { sendEmail, orderConfirmationEmailTemplate } from '../../utils/sendEmail';
import type { PlaceOrderInput, UpdateOrderStatusInput } from './order.schema';

const ORDER_POPULATE = [
  {
    path: 'items.productId',
    select: 'id name slug images',
  },
  { path: 'addressId' },
];

const formatOrder = (order: Record<string, unknown>) => ({
  ...order,
  id: (order._id as mongoose.Types.ObjectId).toString(),
  address: order.addressId,
  items: (order.items as Array<Record<string, unknown>>)?.map((item) => ({
    ...item,
    productId: (item.productId as Record<string, unknown>)?._id?.toString() ?? item.productId,
    product: item.productId,
  })),
});

export const placeOrder = async (userId: string, data: PlaceOrderInput) => {
  const { addressId, paymentMethod, notes } = data;

  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new ApiError(404, 'Address not found.');

  const cart = await Cart.findOne({ userId }).populate('items.productId');
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty. Add items before placing an order.');
  }

  // Validate stock
  for (const item of cart.items) {
    const product = item.productId as unknown as { isActive: boolean; name: string; stock: number };
    if (!product.isActive) {
      throw new ApiError(400, `Product "${product.name}" is no longer available.`);
    }
    if (product.stock < item.quantity) {
      throw new ApiError(400, `Only ${product.stock} units of "${product.name}" available.`);
    }
  }

  const subtotal = cart.items.reduce((sum, item) => {
    const product = item.productId as unknown as { price: number };
    return sum + product.price * item.quantity;
  }, 0);
  const shippingCharge = subtotal >= 50000 ? 0 : 9900;

  // Create order
  const order = await Order.create({
    userId,
    addressId,
    paymentMethod,
    notes,
    totalAmount: subtotal + shippingCharge,
    shippingCharge,
    items: cart.items.map((item) => {
      const product = item.productId as unknown as { _id: mongoose.Types.ObjectId; price: number };
      return { productId: product._id, quantity: item.quantity, price: product.price };
    }),
  });

  // Deduct stock for each product
  for (const item of cart.items) {
    const product = item.productId as unknown as { _id: mongoose.Types.ObjectId };
    await Product.findByIdAndUpdate(product._id, { $inc: { stock: -item.quantity } });
  }

  await clearCart(userId);

  const user = await User.findById(userId);
  if (user) {
    sendEmail({
      to: user.email,
      subject: `Order Confirmed — #${order._id.toString().slice(-8).toUpperCase()}`,
      html: orderConfirmationEmailTemplate(user.name, order._id.toString(), order.totalAmount),
    }).catch(() => {});
  }

  const populated = await Order.findById(order._id).populate(ORDER_POPULATE).lean();
  return formatOrder(populated as unknown as Record<string, unknown>);
};

export const getUserOrders = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find({ userId })
      .populate(ORDER_POPULATE)
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Order.countDocuments({ userId }),
  ]);

  return {
    orders: orders.map((o) => formatOrder(o as unknown as Record<string, unknown>)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const getOrderById = async (userId: string, orderId: string) => {
  const order = await Order.findOne({ _id: orderId, userId })
    .populate(ORDER_POPULATE).lean();
  if (!order) throw new ApiError(404, 'Order not found.');
  return formatOrder(order as unknown as Record<string, unknown>);
};

export const cancelOrder = async (userId: string, orderId: string) => {
  const order = await Order.findOne({ _id: orderId, userId });
  if (!order) throw new ApiError(404, 'Order not found.');

  const cancellable = ['PENDING', 'CONFIRMED'];
  if (!cancellable.includes(order.status)) {
    throw new ApiError(400, `Order in "${order.status}" status cannot be cancelled.`);
  }

  order.status = 'CANCELLED';
  await order.save();

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.productId, { $inc: { stock: item.quantity } });
  }

  const updated = await Order.findById(orderId).populate(ORDER_POPULATE).lean();
  return formatOrder(updated as unknown as Record<string, unknown>);
};

export const trackOrder = async (userId: string, orderId: string) => {
  const order = await Order.findOne({ _id: orderId, userId })
    .select('status trackingId shiprocketOrderId createdAt updatedAt')
    .lean();
  if (!order) throw new ApiError(404, 'Order not found.');
  return { ...order, id: (order as unknown as { _id: mongoose.Types.ObjectId })._id.toString() };
};

// ─── Admin-only ───────────────────────────────────────────────────────────────

export const getAllOrders = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    Order.find()
      .populate([...ORDER_POPULATE, { path: 'userId', select: 'id name email phone' }])
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit).lean(),
    Order.countDocuments(),
  ]);

  return {
    orders: orders.map((o) => formatOrder(o as unknown as Record<string, unknown>)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

export const updateOrderStatus = async (orderId: string, data: UpdateOrderStatusInput) => {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found.');

  order.status = data.status;
  if (data.trackingId) order.trackingId = data.trackingId;
  if (data.shiprocketOrderId) order.shiprocketOrderId = data.shiprocketOrderId;
  await order.save();

  const updated = await Order.findById(orderId).populate(ORDER_POPULATE).lean();
  return formatOrder(updated as unknown as Record<string, unknown>);
};
