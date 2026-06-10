import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { clearCart } from '../cart/cart.service';
import { sendEmail, orderConfirmationEmailTemplate } from '../../utils/sendEmail';
import type { PlaceOrderInput, UpdateOrderStatusInput } from './order.schema';

const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, slug: true, images: true } },
    },
  },
  address: true,
};

export const placeOrder = async (userId: string, data: PlaceOrderInput) => {
  const { addressId, paymentMethod, notes } = data;

  // Verify address belongs to user
  const address = await prisma.address.findFirst({ where: { id: addressId, userId } });
  if (!address) throw new ApiError(404, 'Address not found.');

  // Get cart
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, 'Your cart is empty. Add items before placing an order.');
  }

  // Validate stock
  for (const item of cart.items) {
    if (!item.product.isActive) {
      throw new ApiError(400, `Product "${item.product.name}" is no longer available.`);
    }
    if (item.product.stock < item.quantity) {
      throw new ApiError(
        400,
        `Only ${item.product.stock} units of "${item.product.name}" available.`
      );
    }
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const shippingCharge = subtotal >= 50000 ? 0 : 9900; // Free shipping above ₹500

  // Create order + order items + deduct stock (all in a transaction)
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId,
        addressId,
        paymentMethod,
        notes,
        totalAmount: subtotal + shippingCharge,
        shippingCharge,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          })),
        },
      },
      include: ORDER_INCLUDE,
    });

    // Deduct stock
    for (const item of cart.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    return newOrder;
  });

  // Clear cart
  await clearCart(userId);

  // Send confirmation email (non-blocking)
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user) {
    sendEmail({
      to: user.email,
      subject: `Order Confirmed — #${order.id.slice(0, 8).toUpperCase()}`,
      html: orderConfirmationEmailTemplate(user.name, order.id, order.totalAmount),
    }).catch(() => {});
  }

  return order;
};

export const getUserOrders = async (userId: string, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
    }),
    prisma.order.count({ where: { userId } }),
  ]);

  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const getOrderById = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: ORDER_INCLUDE,
  });
  if (!order) throw new ApiError(404, 'Order not found.');
  return order;
};

export const cancelOrder = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new ApiError(404, 'Order not found.');

  const cancellable: string[] = ['PENDING', 'CONFIRMED'];
  if (!cancellable.includes(order.status)) {
    throw new ApiError(400, `Order in "${order.status}" status cannot be cancelled.`);
  }

  // Restore stock
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED' },
    }),
    ...items.map((item) =>
      prisma.product.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      })
    ),
  ]);

  return prisma.order.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
};

export const trackOrder = async (userId: string, orderId: string) => {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      status: true,
      trackingId: true,
      shiprocketOrderId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!order) throw new ApiError(404, 'Order not found.');
  return order;
};

// ─── Admin-only ───────────────────────────────────────────────────────────────

export const getAllOrders = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        ...ORDER_INCLUDE,
        user: { select: { id: true, name: true, email: true, phone: true } },
      },
    }),
    prisma.order.count(),
  ]);

  return { orders, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

export const updateOrderStatus = async (
  orderId: string,
  data: UpdateOrderStatusInput
) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, 'Order not found.');

  return prisma.order.update({
    where: { id: orderId },
    data: {
      status: data.status,
      ...(data.trackingId && { trackingId: data.trackingId }),
      ...(data.shiprocketOrderId && { shiprocketOrderId: data.shiprocketOrderId }),
    },
    include: ORDER_INCLUDE,
  });
};
