import { Router } from 'express';
import * as ShippingController from './shipping.controller';

const router = Router();

router.post('/check-serviceability', ShippingController.checkServiceability);
router.get('/track/:trackingId', ShippingController.trackShipment);

export default router;
