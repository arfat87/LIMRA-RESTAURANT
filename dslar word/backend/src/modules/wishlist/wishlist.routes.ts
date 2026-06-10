import { Router } from 'express';
import * as WishlistController from './wishlist.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', WishlistController.getWishlist);
router.post('/add/:productId', WishlistController.addToWishlist);
router.delete('/remove/:productId', WishlistController.removeFromWishlist);

export default router;
