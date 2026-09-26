import { Router } from 'express';
import { getHealth } from '../services/health.service.js';

const router = Router();

router.get('/health', async (request, response) => {
  const health = await getHealth();
  const statusCode = health.status === 'ok' ? 200 : 503;

  response.status(statusCode).json({
    status: health.status,
    database: health.database
  });
});

export default router;
