import prisma from '../../config/db';
import { ApiError } from '../../utils/ApiError';
import { uploadToCloudinary } from '../../config/cloudinary';
import type { UpdateProfileInput, AddAddressInput, UpdateAddressInput } from './user.schema';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  isVerified: true,
  avatar: true,
  createdAt: true,
  updatedAt: true,
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_SELECT,
  });
  if (!user) throw new ApiError(404, 'User not found.');
  return user;
};

export const updateProfile = async (userId: string, data: UpdateProfileInput) => {
  // Check phone uniqueness if being updated
  if (data.phone) {
    const existing = await prisma.user.findFirst({
      where: { phone: data.phone, NOT: { id: userId } },
    });
    if (existing) throw new ApiError(409, 'Phone number already in use.');
  }

  return prisma.user.update({
    where: { id: userId },
    data,
    select: USER_SELECT,
  });
};

export const updateAvatar = async (userId: string, fileBuffer: Buffer): Promise<string> => {
  const result = await uploadToCloudinary(fileBuffer, 'dslrworld/avatars');
  await prisma.user.update({
    where: { id: userId },
    data: { avatar: result.secure_url },
  });
  return result.secure_url;
};

// ─── Address Services ─────────────────────────────────────────────────────────

export const getAddresses = async (userId: string) => {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
};

export const addAddress = async (userId: string, data: AddAddressInput) => {
  // If this is the default, unset others
  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  // If no addresses exist, make this default
  const count = await prisma.address.count({ where: { userId } });
  const isDefault = count === 0 ? true : (data.isDefault ?? false);

  return prisma.address.create({
    data: { ...data, isDefault, userId },
  });
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  data: UpdateAddressInput
) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new ApiError(404, 'Address not found.');

  if (data.isDefault) {
    await prisma.address.updateMany({
      where: { userId },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({ where: { id: addressId }, data });
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new ApiError(404, 'Address not found.');

  await prisma.address.delete({ where: { id: addressId } });

  // If deleted was default, make the most recent one default
  if (address.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new ApiError(404, 'Address not found.');

  await prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
  return prisma.address.update({ where: { id: addressId }, data: { isDefault: true } });
};
