import { Router } from 'express';
import * as OrderController from './order.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.post('/', OrderController.placeOrder);
router.get('/', OrderController.getUserOrders);
router.get('/:id', OrderController.getOrderById);
router.post('/:id/cancel', OrderController.cancelOrder);
router.get('/:id/track', OrderController.trackOrder);

export default router;
