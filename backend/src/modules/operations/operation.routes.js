import { Router } from 'express';
import { requireAuth } from '../../middleware/require-auth.js';
import {
  cancelOperation,
  createAdjustment,
  createDelivery,
  createReceipt,
  createTransfer,
  getOperation,
  listLedger,
  transitionDelivery,
  validateOperation
} from './operation.service.js';
import { OPERATION_TYPES } from './operation.constants.js';

const router = Router();

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
const userId = (req) => req.user.id;
const send = (res, data, status = 200) => res.status(status).json({ data });

const registerOperationRoutes = (path, type, createHandler) => {
  router.post(path, requireAuth, asyncRoute(async (req, res) => send(res, await createHandler(userId(req), req.body), 201)));
  router.get(path + '/:operationId', requireAuth, asyncRoute(async (req, res) => send(res, await getOperation(type, req.params.operationId))));
  router.post(path + '/:operationId/validate', requireAuth, asyncRoute(async (req, res) => send(res, await validateOperation(type, req.params.operationId, userId(req)))));
  router.post(path + '/:operationId/cancel', requireAuth, asyncRoute(async (req, res) => send(res, await cancelOperation(type, req.params.operationId, userId(req)))));
};

registerOperationRoutes('/receipts', OPERATION_TYPES.RECEIPT, createReceipt);
registerOperationRoutes('/deliveries', OPERATION_TYPES.DELIVERY, createDelivery);
registerOperationRoutes('/transfers', OPERATION_TYPES.TRANSFER, createTransfer);
registerOperationRoutes('/adjustments', OPERATION_TYPES.ADJUSTMENT, createAdjustment);

router.post('/deliveries/:operationId/pick', requireAuth, asyncRoute(async (req, res) => send(res, await transitionDelivery(req.params.operationId, 'PICKED', userId(req)))));
router.post('/deliveries/:operationId/pack', requireAuth, asyncRoute(async (req, res) => send(res, await transitionDelivery(req.params.operationId, 'PACKED', userId(req)))));

router.get('/stock/ledger', requireAuth, asyncRoute(async (req, res) => send(res, (await listLedger(req.query)).rows)));

export default router;
