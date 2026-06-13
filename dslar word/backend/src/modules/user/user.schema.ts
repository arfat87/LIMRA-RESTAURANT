import { z } from 'zod';

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number')
      .optional(),
  }),
});

export const addAddressSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name is required'),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
    line1: z.string().min(5, 'Address line 1 is required'),
    line2: z.string().optional(),
    city: z.string().min(2, 'City is required'),
    state: z.string().min(2, 'State is required'),
    pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
    isDefault: z.boolean().optional().default(false),
  }),
});

export const updateAddressSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
    line1: z.string().min(5).optional(),
    line2: z.string().optional(),
    city: z.string().min(2).optional(),
    state: z.string().min(2).optional(),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    isDefault: z.boolean().optional(),
  }),
  params: z.object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid address ID') }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type AddAddressInput = z.infer<typeof addAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
