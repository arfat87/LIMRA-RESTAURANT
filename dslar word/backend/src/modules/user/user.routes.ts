import { Router } from 'express';
import * as UserController from './user.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadAvatar } from '../../middlewares/upload.middleware';

const router = Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/me', UserController.getMe);
router.put('/me', UserController.updateMe);
router.put('/me/avatar', uploadAvatar, UserController.uploadAvatar);

router.get('/me/addresses', UserController.getAddresses);
router.post('/me/addresses', UserController.addAddress);
router.put('/me/addresses/:id', UserController.updateAddress);
router.delete('/me/addresses/:id', UserController.deleteAddress);
router.put('/me/addresses/:id/default', UserController.setDefaultAddress);

export default router;
