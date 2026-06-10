import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';

const CART_INCLUDE = {
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          mrp: true,
          discount: true,
          images: true,
          stock: true,
          isActive: true,
          condition: true,
        },
      },
    },
  },
};

export const getCart = async (userId: string) => {
  let cart = await prisma.cart.findUnique({
    where: { userId },
    include: CART_INCLUDE,
  });

  if (!cart) {
    cart = await prisma.cart.create({ data: { userId }, include: CART_INCLUDE });
  }

  const subtotal = cart.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  return { ...cart, subtotal, itemCount: cart.items.length };
};

export const addToCart = async (userId: string, productId: string, quantity: number) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found.');
  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} units available in stock.`);
  }

  let cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) cart = await prisma.cart.create({ data: { userId } });

  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });

  const newQty = existingItem ? existingItem.quantity + quantity : quantity;
  if (product.stock < newQty) {
    throw new ApiError(400, `Only ${product.stock} units available.`);
  }

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    update: { quantity: newQty },
    create: { cartId: cart.id, productId, quantity },
  });

  return getCart(userId);
};

export const updateCartItem = async (userId: string, productId: string, quantity: number) => {
  if (quantity < 1) throw new ApiError(400, 'Quantity must be at least 1.');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} units available.`);
  }

  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  const item = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
  });
  if (!item) throw new ApiError(404, 'Item not in cart.');

  await prisma.cartItem.update({
    where: { cartId_productId: { cartId: cart.id, productId } },
    data: { quantity },
  });

  return getCart(userId);
};

export const removeFromCart = async (userId: string, productId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
  return getCart(userId);
};

export const clearCart = async (userId: string) => {
  const cart = await prisma.cart.findUnique({ where: { userId } });
  if (!cart) return;
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
};
