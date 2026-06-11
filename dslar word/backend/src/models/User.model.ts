import mongoose from 'mongoose';

// ============================================================
// User Model — DSLR WORLD
// ============================================================

export type Role = 'CUSTOMER' | 'ADMIN';

export interface IUser {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: Role;
  isVerified: boolean;
  avatar?: string;
  refreshToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:        { type: String, required: true, unique: true, trim: true },
    password:     { type: String, required: true },
    role:         { type: String, enum: ['CUSTOMER', 'ADMIN'], default: 'CUSTOMER' },
    isVerified:   { type: Boolean, default: false },
    avatar:       { type: String },
    refreshToken: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });

export const User = mongoose.model<IUser>('User', userSchema);
