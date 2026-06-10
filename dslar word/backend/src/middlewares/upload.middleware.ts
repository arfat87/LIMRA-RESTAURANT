import multer from 'multer';
import { Request } from 'express';
import { ApiError } from '../utils/ApiError';

// ─── Multer Configuration ─────────────────────────────────────────────────────

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
): void => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, 'Only JPEG, PNG and WebP images are allowed.'));
  }
};

// Use memory storage — buffers uploaded to Cloudinary directly
const storage = multer.memoryStorage();

/**
 * Single image upload (field name: 'image')
 */
export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).single('image');

/**
 * Multiple image upload (field name: 'images', max 10)
 */
export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
}).array('images', 10);

/**
 * Avatar upload (field name: 'avatar')
 */
export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB for avatars
}).single('avatar');
