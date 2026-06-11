import { Cart } from '../../models/Cart.model';
import { Product } from '../../models/Product.model';
import { ApiError } from '../../utils/ApiError';

const PRODUCT_POPULATE = {
  path: 'items.productId',
  select: 'id name slug price mrp discount images stock isActive condition',
};

const formatCart = (cart: Awaited<ReturnType<typeof Cart.findOne>>) => {
  if (!cart) return null;
  const items = cart.items.map((item) => {
    const product = item.productId as unknown as Record<string, unknown>;
    return {
      productId: product?._id?.toString() ?? item.productId.toString(),
      quantity: item.quantity,
      product,
    };
  });
  const subtotal = items.reduce((sum, item) => {
    const price = (item.product?.price as number) ?? 0;
    return sum + price * item.quantity;
  }, 0);
  return {
    id: cart._id.toString(),
    userId: cart.userId.toString(),
    items,
    subtotal,
    itemCount: items.length,
  };
};

export const getCart = async (userId: string) => {
  let cart = await Cart.findOne({ userId }).populate(PRODUCT_POPULATE);
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
    await cart.populate(PRODUCT_POPULATE);
  }
  return formatCart(cart);
};

export const addToCart = async (userId: string, productId: string, quantity: number) => {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found.');
  if (product.stock < quantity) {
    throw new ApiError(400, `Only ${product.stock} units available in stock.`);
  }

  let cart = await Cart.findOne({ userId });
  if (!cart) cart = await Cart.create({ userId, items: [] });

  const itemIndex = cart.items.findIndex((i) => i.productId.toString() === productId);
  const newQty = itemIndex >= 0 ? cart.items[itemIndex].quantity + quantity : quantity;

  if (product.stock < newQty) throw new ApiError(400, `Only ${product.stock} units available.`);

  if (itemIndex >= 0) {
    cart.items[itemIndex].quantity = newQty;
  } else {
    cart.items.push({ productId: product._id, quantity });
  }

  await cart.save();
  return getCart(userId);
};

export const updateCartItem = async (userId: string, productId: string, quantity: number) => {
  if (quantity < 1) throw new ApiError(400, 'Quantity must be at least 1.');

  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found.');
  if (product.stock < quantity) throw new ApiError(400, `Only ${product.stock} units available.`);

  const cart = await Cart.findOne({ userId });
  if (!cart) throw new ApiError(404, 'Cart not found.');

  const itemIndex = cart.items.findIndex((i) => i.productId.toString() === productId);
  if (itemIndex < 0) throw new ApiError(404, 'Item not in cart.');

  cart.items[itemIndex].quantity = quantity;
  await cart.save();
  return getCart(userId);
};

export const removeFromCart = async (userId: string, productId: string) => {
  const cart = await Cart.findOne({ userId });
  if (!cart) throw new ApiError(404, 'Cart not found.');
  cart.items = cart.items.filter((i) => i.productId.toString() !== productId);
  await cart.save();
  return getCart(userId);
};

export const clearCart = async (userId: string) => {
  await Cart.findOneAndUpdate({ userId }, { items: [] });
};
