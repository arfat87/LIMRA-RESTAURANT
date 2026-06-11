import { User } from '../../models/User.model';
import { Address } from '../../models/Address.model';
import { ApiError } from '../../utils/ApiError';
import { uploadToCloudinary } from '../../config/cloudinary';
import type { UpdateProfileInput, AddAddressInput, UpdateAddressInput } from './user.schema';

const USER_SELECT = 'id name email phone role isVerified avatar createdAt updatedAt';

export const getUserById = async (userId: string) => {
  const user = await User.findById(userId).select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found.');
  return { ...user.toObject(), id: user._id.toString() };
};

export const updateProfile = async (userId: string, data: UpdateProfileInput) => {
  if (data.phone) {
    const existing = await User.findOne({ phone: data.phone, _id: { $ne: userId } });
    if (existing) throw new ApiError(409, 'Phone number already in use.');
  }
  const user = await User.findByIdAndUpdate(userId, data, { new: true })
    .select('-password -refreshToken');
  if (!user) throw new ApiError(404, 'User not found.');
  return { ...user.toObject(), id: user._id.toString() };
};

export const updateAvatar = async (userId: string, fileBuffer: Buffer): Promise<string> => {
  const result = await uploadToCloudinary(fileBuffer, 'dslrworld/avatars');
  await User.findByIdAndUpdate(userId, { avatar: result.secure_url });
  return result.secure_url;
};

// ─── Address Services ─────────────────────────────────────────────────────────

export const getAddresses = async (userId: string) => {
  const addresses = await Address.find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean();
  return addresses.map((a) => ({ ...a, id: a._id.toString() }));
};

export const addAddress = async (userId: string, data: AddAddressInput) => {
  if (data.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false });
  }
  const count = await Address.countDocuments({ userId });
  const isDefault = count === 0 ? true : (data.isDefault ?? false);

  const address = await Address.create({ ...data, isDefault, userId });
  return { ...address.toObject(), id: address._id.toString() };
};

export const updateAddress = async (userId: string, addressId: string, data: UpdateAddressInput) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new ApiError(404, 'Address not found.');

  if (data.isDefault) {
    await Address.updateMany({ userId }, { isDefault: false });
  }

  const updated = await Address.findByIdAndUpdate(addressId, data, { new: true });
  return { ...updated!.toObject(), id: updated!._id.toString() };
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new ApiError(404, 'Address not found.');
  await address.deleteOne();

  if (address.isDefault) {
    const next = await Address.findOne({ userId }).sort({ createdAt: -1 });
    if (next) await Address.findByIdAndUpdate(next._id, { isDefault: true });
  }
};

export const setDefaultAddress = async (userId: string, addressId: string) => {
  const address = await Address.findOne({ _id: addressId, userId });
  if (!address) throw new ApiError(404, 'Address not found.');

  await Address.updateMany({ userId }, { isDefault: false });
  const updated = await Address.findByIdAndUpdate(addressId, { isDefault: true }, { new: true });
  return { ...updated!.toObject(), id: updated!._id.toString() };
};
