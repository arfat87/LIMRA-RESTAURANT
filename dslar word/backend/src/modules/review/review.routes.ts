import { Router } from 'express';
import * as ReviewController from './review.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';

const router = Router();

// Public
router.get('/product/:productId', ReviewController.getProductReviews);

// Protected
router.post('/product/:productId', authMiddleware, ReviewController.addReview);
router.delete('/:id', authMiddleware, ReviewController.deleteReview);

export default router;
