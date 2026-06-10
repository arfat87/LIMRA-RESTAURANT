import { Router } from 'express';
import * as CategoryController from './category.controller';

const router = Router();

router.get('/', CategoryController.getAllCategories);
router.get('/:slug/products', CategoryController.getProductsByCategory);

export default router;
