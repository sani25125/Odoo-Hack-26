import crypto from 'node:crypto';
import { query, withTransaction } from '../../database/pool.js';
import { DomainError } from '../../errors/domain-error.js';
import { createLedgerEntry } from '../../repositories/ledger.repository.js';
import {
  createDetail,
  createLines,
  createOperation,
  findLines,
  getOperationDetails,
  lockOperation,
  updateStatus
} from '../../repositories/operation.repository.js';
import { applyDelta, lockBalances, setQuantity } from '../../repositories/stock.repository.js';
import { ENTRY_KINDS, OPERATION_STATUSES, OPERATION_TYPES } from './operation.constants.js';
import { requireLines, requireText, validateQuantity } from './operation.validation.js';

const operationReference = () => crypto.randomUUID();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertUuid = (value, fieldName) => {
  if (typeof value !== 'string' || !uuidPattern.test(value)) {
    throw new DomainError(fieldName + ' must be a valid UUID', 400, 'VALIDATION_ERROR', { [fieldName]: 'Invalid UUID' });
  }
};

const assertUser = (userId) => {
  if (!userId) {
    throw new DomainError('Authentication is required', 401, 'UNAUTHORIZED');
  }
};

const assertActiveProductLocation = async (client, productId, locationId) => {
  const result = await client.query(
    'SELECT p.id AS product_id, l.id AS location_id FROM products p CROSS JOIN locations l WHERE p.id = $1 AND l.id = $2 AND p.is_active = true AND l.is_active = true',
    [productId, locationId]
  );
  if (result.rowCount === 0) {
    throw new DomainError('Product or location was not found or is inactive', 404, 'NOT_FOUND');
  }
};

const assertLineIds = (line, fields) => {
  for (const field of fields) {
    if (line[field] === undefined || line[field] === null || line[field] === '') {
      throw new DomainError(field + ' is required', 400, 'VALIDATION_ERROR', { [field]: 'Required' });
    }
    if (field !== 'physicalCountedQuantity') assertUuid(line[field], field);
  }
};

const assertUnique = (lines, makeKey) => {
  const keys = lines.map(makeKey);
  if (new Set(keys).size !== keys.length) {
    throw new DomainError('Duplicate lines are not allowed', 409, 'CONFLICT');
  }
};

const createBase = async (userId, operationType, detail, lines) => {
  assertUser(userId);
  return withTransaction(async (client) => {
    await validateReferences(client, operationType, detail, lines);
    const operation = await createOperation(client, {
      operationType,
      reference: operationReference(),
      userId
    });
    await createDetail(client, operationType, operation.id, detail);
    await createLines(client, operationType, operation.id, lines);
    return getOperationDetails(client, operationType, operation.id);
  });
};

export const createReceipt = (userId, body) => {
  const inputLines = requireLines(body.lines);
  inputLines.forEach((line) => assertLineIds(line, ['productId', 'destinationLocationId']));
  if (new Set(inputLines.map((line) => line.destinationLocationId)).size !== 1) {
    throw new DomainError('All receipt lines must use the same destination location', 400, 'VALIDATION_ERROR');
  }
  const lines = inputLines.map((line) => ({
    product_id: line.productId,
    quantity: validateQuantity(line.quantity)
  }));
  assertUnique(lines, (line) => line.product_id);
  return createBase(userId, OPERATION_TYPES.RECEIPT, { destination_location_id: inputLines[0].destinationLocationId, supplier_reference: body.supplierName?.trim() || null }, lines);
};

export const createDelivery = (userId, body) => {
  const inputLines = requireLines(body.lines);
  inputLines.forEach((line) => assertLineIds(line, ['productId', 'sourceLocationId']));
  if (new Set(inputLines.map((line) => line.sourceLocationId)).size !== 1) {
    throw new DomainError('All delivery lines must use the same source location', 400, 'VALIDATION_ERROR');
  }
  const lines = inputLines.map((line) => ({
    product_id: line.productId,
    quantity: validateQuantity(line.quantity)
  }));
  assertUnique(lines, (line) => line.product_id);
  return createBase(userId, OPERATION_TYPES.DELIVERY, { source_location_id: inputLines[0].sourceLocationId, customer_reference: body.customerName?.trim() || null }, lines);
};

export const createTransfer = (userId, body) => {
  const inputLines = requireLines(body.lines);
  inputLines.forEach((line) => assertLineIds(line, ['productId', 'sourceLocationId', 'destinationLocationId']));
  if (new Set(inputLines.map((line) => line.sourceLocationId + ':' + line.destinationLocationId)).size !== 1) {
    throw new DomainError('All transfer lines must use the same source and destination locations', 400, 'VALIDATION_ERROR');
  }
  const lines = inputLines.map((line) => ({
    product_id: line.productId,
    quantity: validateQuantity(line.quantity),
    source_location_id: line.sourceLocationId,
    destination_location_id: line.destinationLocationId
  }));
  assertUnique(lines, (line) => line.product_id + ':' + line.source_location_id + ':' + line.destination_location_id);
  if (lines.some((line) => line.source_location_id === line.destination_location_id)) {
    throw new DomainError('Source and destination locations must differ', 400, 'VALIDATION_ERROR');
  }
  return createBase(userId, OPERATION_TYPES.TRANSFER, {
    source_location_id: lines[0].source_location_id,
    destination_location_id: lines[0].destination_location_id
  }, lines.map((line) => ({ product_id: line.product_id, quantity: line.quantity })));
};

export const createAdjustment = (userId, body) => {
  const inputLines = requireLines(body.lines);
  inputLines.forEach((line) => assertLineIds(line, ['productId', 'locationId', 'physicalCountedQuantity']));
  const lines = inputLines.map((line) => ({
    product_id: line.productId,
    location_id: line.locationId,
    physical_counted_quantity: validateQuantity(line.physicalCountedQuantity, 'physicalCountedQuantity', true)
  }));
  assertUnique(lines, (line) => line.product_id + ':' + line.location_id);
  return createBase(userId, OPERATION_TYPES.ADJUSTMENT, { location_id: lines[0].location_id, reason: requireText(body.reason, 'reason') }, lines);
};

export const getOperation = (operationType, operationId) => {
  assertUuid(operationId, 'operationId');
  return withTransaction((client) => getOperationDetails(client, operationType, operationId));
};

const ensureType = (operation, operationType) => {
  if (operation.operation_type !== operationType) {
    throw new DomainError('Operation not found', 404, 'NOT_FOUND');
  }
};

export const transitionDelivery = (operationId, nextStatus, userId) => {
  assertUser(userId);
  assertUuid(operationId, 'operationId');
  return withTransaction(async (client) => {
    const operation = await lockOperation(client, operationId);
    ensureType(operation, OPERATION_TYPES.DELIVERY);
    const allowed = (nextStatus === OPERATION_STATUSES.PICKED && operation.status === OPERATION_STATUSES.DRAFT)
      || (nextStatus === OPERATION_STATUSES.PACKED && operation.status === OPERATION_STATUSES.PICKED);
    if (!allowed) {
      throw new DomainError('Invalid delivery status transition', 409, 'INVALID_STATUS');
    }
    await updateStatus(client, operationId, nextStatus, userId);
    return getOperationDetails(client, OPERATION_TYPES.DELIVERY, operationId);
  });
};

export const cancelOperation = (operationType, operationId, userId) => {
  assertUser(userId);
  assertUuid(operationId, 'operationId');
  return withTransaction(async (client) => {
    const operation = await lockOperation(client, operationId);
    ensureType(operation, operationType);
    const allowed = operation.status === OPERATION_STATUSES.DRAFT
      || (operationType === OPERATION_TYPES.DELIVERY && [OPERATION_STATUSES.PICKED, OPERATION_STATUSES.PACKED].includes(operation.status));
    if (!allowed) {
      throw new DomainError('Operation cannot be canceled in its current state', 409, 'INVALID_STATUS');
    }
    await updateStatus(client, operationId, OPERATION_STATUSES.CANCELED, userId);
    return getOperationDetails(client, operationType, operationId);
  });
};

const validateReferences = async (client, operationType, detail, lines) => {
  for (const line of lines) {
    if (operationType === OPERATION_TYPES.RECEIPT) await assertActiveProductLocation(client, line.product_id, detail.destination_location_id);
    if (operationType === OPERATION_TYPES.DELIVERY) await assertActiveProductLocation(client, line.product_id, detail.source_location_id);
    if (operationType === OPERATION_TYPES.TRANSFER) {
      await assertActiveProductLocation(client, line.product_id, detail.source_location_id);
      await assertActiveProductLocation(client, line.product_id, detail.destination_location_id);
    }
    if (operationType === OPERATION_TYPES.ADJUSTMENT) await assertActiveProductLocation(client, line.product_id, detail.location_id);
  }
};

export const validateOperation = (operationType, operationId, userId) => {
  assertUser(userId);
  assertUuid(operationId, 'operationId');
  return withTransaction(async (client) => {
    const operation = await lockOperation(client, operationId);
    ensureType(operation, operationType);
    if (operation.status === OPERATION_STATUSES.DONE) return getOperationDetails(client, operationType, operationId);
    if (operation.status === OPERATION_STATUSES.CANCELED) throw new DomainError('Canceled operations cannot be validated', 409, 'INVALID_STATUS');
    const requiredStatus = operationType === OPERATION_TYPES.DELIVERY ? OPERATION_STATUSES.PACKED : OPERATION_STATUSES.DRAFT;
    if (operation.status !== requiredStatus) throw new DomainError('Operation is not ready for validation', 409, 'INVALID_STATUS');

    const details = await getOperationDetails(client, operationType, operationId);
    const lines = details.lines;
    if (lines.length === 0) throw new DomainError('At least one line is required', 400, 'VALIDATION_ERROR');
    await validateReferences(client, operationType, details.detail, lines);
    const keys = [];
    for (const line of lines) {
      if (operationType === OPERATION_TYPES.RECEIPT) keys.push({ productId: line.product_id, locationId: details.detail.destination_location_id });
      if (operationType === OPERATION_TYPES.DELIVERY) keys.push({ productId: line.product_id, locationId: details.detail.source_location_id });
      if (operationType === OPERATION_TYPES.TRANSFER) keys.push({ productId: line.product_id, locationId: details.detail.source_location_id }, { productId: line.product_id, locationId: details.detail.destination_location_id });
      if (operationType === OPERATION_TYPES.ADJUSTMENT) keys.push({ productId: line.product_id, locationId: details.detail.location_id });
    }
    const balances = await lockBalances(client, keys);
    for (const line of lines) {
      if (operationType === OPERATION_TYPES.RECEIPT) {
        const key = { productId: line.product_id, locationId: details.detail.destination_location_id };
        const result = await applyDelta(client, key, line.quantity, balances);
        await createLedgerEntry(client, { operationId, operationReference: operation.reference, entryKind: ENTRY_KINDS.RECEIPT, productId: line.product_id, locationId: key.locationId, quantityDelta: line.quantity, quantityBefore: result.quantity_before, quantityAfter: result.quantity_after, receiptLineId: line.id, createdBy: userId });
      }
      if (operationType === OPERATION_TYPES.DELIVERY) {
        const key = { productId: line.product_id, locationId: details.detail.source_location_id };
        const result = await applyDelta(client, key, '-' + line.quantity, balances);
        await createLedgerEntry(client, { operationId, operationReference: operation.reference, entryKind: ENTRY_KINDS.DELIVERY, productId: line.product_id, locationId: key.locationId, quantityDelta: '-' + line.quantity, quantityBefore: result.quantity_before, quantityAfter: result.quantity_after, deliveryLineId: line.id, createdBy: userId });
      }
      if (operationType === OPERATION_TYPES.TRANSFER) {
        const source = { productId: line.product_id, locationId: details.detail.source_location_id };
        const destination = { productId: line.product_id, locationId: details.detail.destination_location_id };
        const outgoing = await applyDelta(client, source, '-' + line.quantity, balances);
        const incoming = await applyDelta(client, destination, line.quantity, balances);
        await createLedgerEntry(client, { operationId, operationReference: operation.reference, entryKind: ENTRY_KINDS.TRANSFER_OUT, productId: line.product_id, locationId: source.locationId, quantityDelta: '-' + line.quantity, quantityBefore: outgoing.quantity_before, quantityAfter: outgoing.quantity_after, transferLineId: line.id, createdBy: userId });
        await createLedgerEntry(client, { operationId, operationReference: operation.reference, entryKind: ENTRY_KINDS.TRANSFER_IN, productId: line.product_id, locationId: destination.locationId, quantityDelta: line.quantity, quantityBefore: incoming.quantity_before, quantityAfter: incoming.quantity_after, transferLineId: line.id, createdBy: userId });
      }
      if (operationType === OPERATION_TYPES.ADJUSTMENT) {
        const key = { productId: line.product_id, locationId: details.detail.location_id };
        const result = await setQuantity(client, key, line.physical_counted_quantity, balances);
        const adjustmentResult = await client.query(
          'UPDATE adjustment_lines SET recorded_quantity_before = $2, stock_quantity_after = $3, difference = $3::numeric - $2::numeric WHERE id = $1 RETURNING difference',
          [line.id, result.quantity_before, result.quantity_after]
        );
        await createLedgerEntry(client, { operationId, operationReference: operation.reference, entryKind: ENTRY_KINDS.ADJUSTMENT, productId: line.product_id, locationId: key.locationId, quantityDelta: adjustmentResult.rows[0].difference, quantityBefore: result.quantity_before, quantityAfter: result.quantity_after, adjustmentLineId: line.id, createdBy: userId });
      }
    }
    await updateStatus(client, operationId, OPERATION_STATUSES.DONE, userId);
    return getOperationDetails(client, operationType, operationId);
  });
};

export const listLedger = (parameters = {}) => {
  const values = [];
  const conditions = [];
  const add = (column, value) => { values.push(value); conditions.push(column + ' = $' + values.length); };
  if (parameters.productId) add('product_id', parameters.productId);
  if (parameters.locationId) add('location_id', parameters.locationId);
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  values.push(Math.min(Number(parameters.limit) || 50, 100));
  return query('SELECT * FROM stock_ledger' + where + ' ORDER BY created_at DESC LIMIT $' + values.length, values);
};
