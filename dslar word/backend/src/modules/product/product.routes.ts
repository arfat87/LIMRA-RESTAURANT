import { Router } from 'express';
import * as ProductController from './product.controller';

const router = Router();

// All public routes
router.get('/', ProductController.getProducts);
router.get('/featured', ProductController.getFeaturedProducts);
router.get('/search', ProductController.searchProducts);
router.get('/:slug', ProductController.getProductBySlug);

export default router;
