import { DomainError } from '../errors/domain-error.js';

const keyFor = (productId, locationId) => productId + ':' + locationId;

export const lockBalances = async (client, keys) => {
  const uniqueKeys = Array.from(new Map(keys.map((key) => [keyFor(key.productId, key.locationId), key])).values())
    .sort((left, right) => keyFor(left.productId, left.locationId).localeCompare(keyFor(right.productId, right.locationId)));
  const balances = new Map();

  for (const key of uniqueKeys) {
    await client.query(
      'INSERT INTO stock_balances (product_id, location_id, quantity) VALUES ($1, $2, 0) ON CONFLICT (product_id, location_id) DO NOTHING',
      [key.productId, key.locationId]
    );
    const result = await client.query(
      'SELECT * FROM stock_balances WHERE product_id = $1 AND location_id = $2 FOR UPDATE',
      [key.productId, key.locationId]
    );
    balances.set(keyFor(key.productId, key.locationId), result.rows[0]);
  }

  return balances;
};

export const applyDelta = async (client, key, delta, balances) => {
  const balance = balances.get(keyFor(key.productId, key.locationId));
  if (!balance) {
    throw new DomainError('Stock balance was not locked', 500, 'INTERNAL_ERROR');
  }

  const result = await client.query(
    'UPDATE stock_balances SET quantity = quantity + $3::numeric, updated_at = now() WHERE product_id = $1 AND location_id = $2 AND quantity + $3::numeric >= 0 RETURNING quantity - $3::numeric AS quantity_before, quantity AS quantity_after',
    [key.productId, key.locationId, delta]
  );

  if (result.rowCount === 0) {
    throw new DomainError('Insufficient stock', 409, 'INSUFFICIENT_STOCK');
  }

  return result.rows[0];
};

export const setQuantity = async (client, key, quantity, balances) => {
  const balance = balances.get(keyFor(key.productId, key.locationId));
  if (!balance) {
    throw new DomainError('Stock balance was not locked', 500, 'INTERNAL_ERROR');
  }

  const result = await client.query(
    'UPDATE stock_balances SET quantity = $3::numeric, updated_at = now() WHERE product_id = $1 AND location_id = $2 RETURNING quantity AS quantity_after',
    [key.productId, key.locationId, quantity]
  );
  const current = balance.quantity;
  return { quantity_before: current, quantity_after: result.rows[0].quantity_after };
};
