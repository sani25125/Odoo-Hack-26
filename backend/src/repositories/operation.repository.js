import { DomainError } from '../errors/domain-error.js';

const detailTables = {
  RECEIPT: 'receipts',
  DELIVERY: 'deliveries',
  TRANSFER: 'transfers',
  ADJUSTMENT: 'adjustments'
};

const lineTables = {
  RECEIPT: 'receipt_lines',
  DELIVERY: 'delivery_lines',
  TRANSFER: 'transfer_lines',
  ADJUSTMENT: 'adjustment_lines'
};

export const createOperation = async (client, { operationType, reference, userId }) => {
  const result = await client.query(
    'INSERT INTO inventory_operations (reference, operation_type, created_by) VALUES ($1, $2, $3) RETURNING *',
    [reference, operationType, userId]
  );
  return result.rows[0];
};

export const createDetail = async (client, operationType, operationId, detail) => {
  const table = detailTables[operationType];
  const fields = Object.keys(detail);
  const values = Object.values(detail);
  const columns = ['operation_id'].concat(fields).join(', ');
  const placeholders = ['$1'].concat(values.map((_, index) => '$' + (index + 2))).join(', ');
  const result = await client.query(
    'INSERT INTO ' + table + ' (' + columns + ') VALUES (' + placeholders + ') RETURNING *',
    [operationId].concat(values)
  );
  return result.rows[0];
};

export const createLines = async (client, operationType, operationId, lines) => {
  const table = lineTables[operationType];
  const rows = [];

  for (const line of lines) {
    const fields = Object.keys(line);
    const values = Object.values(line);
    const columns = ['operation_id'].concat(fields).join(', ');
    const placeholders = ['$1'].concat(values.map((_, index) => '$' + (index + 2))).join(', ');
    const result = await client.query(
      'INSERT INTO ' + table + ' (' + columns + ') VALUES (' + placeholders + ') RETURNING *',
      [operationId].concat(values)
    );
    rows.push(result.rows[0]);
  }

  return rows;
};

export const lockOperation = async (client, operationId) => {
  const result = await client.query(
    'SELECT * FROM inventory_operations WHERE id = $1 FOR UPDATE',
    [operationId]
  );

  if (result.rowCount === 0) {
    throw new DomainError('Operation not found', 404, 'NOT_FOUND');
  }

  return result.rows[0];
};

export const findOperation = async (client, operationId) => {
  const result = await client.query('SELECT * FROM inventory_operations WHERE id = $1', [operationId]);
  return result.rows[0] ?? null;
};

export const findLines = async (client, operationType, operationId) => {
  const table = lineTables[operationType];
  const result = await client.query(
    'SELECT * FROM ' + table + ' WHERE operation_id = $1 ORDER BY id',
    [operationId]
  );
  return result.rows;
};

export const getOperationDetails = async (client, operationType, operationId) => {
  const operation = await findOperation(client, operationId);
  if (!operation || operation.operation_type !== operationType) {
    throw new DomainError('Operation not found', 404, 'NOT_FOUND');
  }

  const detailResult = await client.query(
    'SELECT * FROM ' + detailTables[operationType] + ' WHERE operation_id = $1',
    [operationId]
  );

  return {
    operation,
    detail: detailResult.rows[0] ?? null,
    lines: await findLines(client, operationType, operationId)
  };
};

export const updateStatus = async (client, operationId, status, userId) => {
  let queryText = 'UPDATE inventory_operations SET status = $2, updated_at = now()';
  const parameters = [operationId, status];

  if (status === 'DONE') {
    queryText += ', validated_by = $3, validated_at = now()';
    parameters.push(userId);
  }

  if (status === 'CANCELED') {
    queryText += ', canceled_by = $3, canceled_at = now()';
    parameters.push(userId);
  }

  queryText += ' WHERE id = $1 RETURNING *';
  const result = await client.query(queryText, parameters);
  return result.rows[0];
};
