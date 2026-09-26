import { Router } from 'express';
import healthRoutes from './health.routes.js';
import operationRoutes from '../modules/operations/operation.routes.js';

const router = Router();

router.use(healthRoutes);
router.use(operationRoutes);

export default router;
