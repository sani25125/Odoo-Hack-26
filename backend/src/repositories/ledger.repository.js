export const createLedgerEntry = async (client, entry) => {
  const result = await client.query(
    'INSERT INTO stock_ledger (operation_id, operation_reference, entry_kind, product_id, location_id, quantity_delta, quantity_before, quantity_after, receipt_line_id, delivery_line_id, transfer_line_id, adjustment_line_id, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *',
    [
      entry.operationId,
      entry.operationReference,
      entry.entryKind,
      entry.productId,
      entry.locationId,
      entry.quantityDelta,
      entry.quantityBefore,
      entry.quantityAfter,
      entry.receiptLineId ?? null,
      entry.deliveryLineId ?? null,
      entry.transferLineId ?? null,
      entry.adjustmentLineId ?? null,
      entry.createdBy
    ]
  );
  return result.rows[0];
};
