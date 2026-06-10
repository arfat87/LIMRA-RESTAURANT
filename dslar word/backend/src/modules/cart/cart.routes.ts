import { Router } from 'express';
import * as CartController from './cart.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', CartController.getCart);
router.post('/add', CartController.addToCart);
router.put('/update', CartController.updateCartItem);
router.delete('/remove/:productId', CartController.removeFromCart);
router.delete('/clear', CartController.clearCart);

export default router;
