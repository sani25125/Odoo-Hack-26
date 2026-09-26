# StockSense REST API Contract

## 1. API Scope

Base path:

    /api/v1

The API exposes only approved MVP functionality:

- Demo authentication
- Products
- Read-only categories
- Read-only warehouse locations
- Current stock
- Receipts
- Deliveries
- Internal transfers
- Inventory adjustments
- Dashboard summary
- Stock ledger
- Operation search and filters

General user sign-up, product deletion, full warehouse administration, supplier management, customer management, barcode scanning, external integrations, and negative stock configuration are out of scope.

## 2. Conventions

### Authentication

Protected endpoints use the authenticated HTTP-only session cookie.

Authorization levels:

- Public: no session required.
- Authenticated: valid session required.

The MVP has one demo role. Granular role permissions are out of scope.

### IDs and Dates

- IDs are UUID strings.
- Dates are ISO 8601 timestamps.
- Quantities are decimal numbers represented without floating-point assumptions.

### Pagination

List endpoints support:

- limit
- cursor

Ledger and operation history must use keyset pagination. Offset pagination is not required for the MVP.

### Standard Error Response

All errors use this shape:

    {
      code: stable_error_code,
      message: human_readable_message,
      fieldErrors: optional_object
    }

Common error codes:

- VALIDATION_ERROR
- UNAUTHORIZED
- NOT_FOUND
- CONFLICT
- INSUFFICIENT_STOCK
- INVALID_STATUS
- ALREADY_COMPLETED
- INTERNAL_ERROR

## 3. Authentication Endpoints

### POST /auth/login

Purpose: Authenticate the demo user and create a session.

Authorization: Public.

Parameters: None.

Request body:

- email
- password

Success response: 200 with user summary. Sets an HTTP-only session cookie.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- Email and password are required.
- User must exist, be active, and have a matching password.

Database effect:

- Reads users.
- Creates or refreshes the authenticated session.
- Does not change inventory.

### GET /auth/me

Purpose: Return the current authenticated user.

Authorization: Authenticated.

Parameters: None.

Request body: None.

Success response: 200 with user ID, email, display name, and active status.

Error response:

- 401 UNAUTHORIZED

Validation: Valid session is required.

Database effect: Reads the authenticated user only.

### POST /auth/logout

Purpose: End the current session.

Authorization: Authenticated.

Parameters: None.

Request body: None.

Success response: 204. Clears or revokes the session.

Error response:

- 401 UNAUTHORIZED

Validation: Valid session is required.

Database effect: Revokes or expires the session. No inventory effect.

### POST /auth/password-reset/request

Purpose: Start the mocked OTP password-reset flow.

Authorization: Public.

Parameters: None.

Request body:

- email

Success response: 202. The response must not reveal whether the email exists.

Error response:

- 400 VALIDATION_ERROR

Validation:

- Email format is valid.
- Rate limiting should be applied if implemented.

Database effect:

- Creates a password reset token for an existing user.
- No inventory effect.

This endpoint is P1.

### POST /auth/password-reset/confirm

Purpose: Complete the mocked OTP password-reset flow.

Authorization: Public.

Parameters: None.

Request body:

- email
- otp
- newPassword

Success response: 204.

Error response:

- 400 VALIDATION_ERROR
- 409 CONFLICT for expired, consumed, or invalid OTP

Validation:

- OTP is valid and unconsumed.
- OTP has not expired.
- New password meets the configured minimum.

Database effect:

- Updates the password hash.
- Marks the reset token consumed.
- No inventory effect.

This endpoint is P1.

## 4. Category and Location Endpoints

### GET /categories

Purpose: Return categories for product selection and filtering.

Authorization: Authenticated.

Parameters:

- search, optional
- active, optional

Request body: None.

Success response: 200 with category list.

Error response:

- 401 UNAUTHORIZED

Validation: Query values must be valid strings.

Database effect: Read-only category query.

Category creation and deletion are not API features in the MVP. Categories are seeded or managed outside the competition flow.

### GET /locations

Purpose: Return active locations in the MVP warehouse.

Authorization: Authenticated.

Parameters:

- warehouseId, optional
- active, optional

Request body: None.

Success response: 200 with location ID, warehouse ID, code, name, and active status.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND for an unknown warehouse filter

Validation: If supplied, warehouseId must be a valid UUID.

Database effect: Read-only location query.

Location creation, deletion, and warehouse administration are out of scope. Locations are seeded for the MVP.

## 5. Product Endpoints

### GET /products

Purpose: Search and list products.

Authorization: Authenticated.

Parameters:

- search, optional name or SKU search
- categoryId, optional
- active, optional
- limit, optional
- cursor, optional

Request body: None.

Success response: 200 with product summaries and optional stock summary.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- UUID filters must be valid UUIDs.
- limit must be within the configured maximum.

Database effect: Read-only product query. P1.

### GET /products/:productId

Purpose: Return one product and its basic stock summary.

Authorization: Authenticated.

Parameters:

- productId path parameter

Request body: None.

Success response: 200 with product fields and total stock.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: productId must be a valid UUID and reference an existing product.

Database effect: Read-only product and stock-balance query.

### POST /products

Purpose: Create a product.

Authorization: Authenticated.

Parameters: None.

Request body:

- name
- sku
- categoryId
- unitOfMeasure
- reorderThreshold
- initialStock, optional object containing quantity and locationId

Success response: 201 with the created product.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND for an unknown category or initial-stock location
- 409 CONFLICT for duplicate SKU

Validation:

- Required fields are present.
- SKU is unique case-insensitively.
- reorderThreshold is non-negative.
- If initialStock is supplied, quantity is positive and locationId is valid.
- Initial stock cannot be negative.

Database effect:

- Creates the product.
- If initial stock is supplied, creates a completed OPENING operation, opening line, stock balance, and opening ledger entry in the same transaction.

### PATCH /products/:productId

Purpose: Update an existing product.

Authorization: Authenticated.

Parameters:

- productId path parameter

Request body: Any editable product fields:

- name
- sku
- categoryId
- unitOfMeasure
- reorderThreshold
- active status if deactivation is supported

Success response: 200 with the updated product.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 CONFLICT for duplicate SKU or invalid historical change

Validation:

- Product exists.
- SKU remains unique.
- Reorder threshold is non-negative.
- Product deletion is not supported.

Database effect: Updates product master data only. It does not change stock or create a ledger entry.

### GET /products/:productId/stock

Purpose: Show stock availability for a product by location.

Authorization: Authenticated.

Parameters:

- productId path parameter
- locationId, optional

Request body: None.

Success response: 200 with location balances and total stock.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: Product and optional location must exist.

Database effect: Read-only stock-balance query. P1.

## 6. Stock Endpoints

### GET /stock

Purpose: Query current stock balances by product and location.

Authorization: Authenticated.

Parameters:

- productId, optional
- locationId, optional
- categoryId, optional
- limit, optional
- cursor, optional

Request body: None.

Success response: 200 with product, location, quantity, reorder status, and total product quantity.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- UUID parameters must be valid.
- limit must be within the configured maximum.

Database effect: Read-only query over stock_balances, products, locations, and categories.

This endpoint supports the P1 stock-by-location view.

## 7. Generic Operation Search

### GET /operations

Purpose: Search operation summaries across receipts, deliveries, transfers, and adjustments.

Authorization: Authenticated.

Parameters:

- documentType, optional
- status, optional
- locationId, optional
- categoryId, optional
- limit, optional
- cursor, optional

Request body: None.

Success response: 200 with operation ID, type, status, created time, and summary fields.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- documentType and status must be supported values.
- UUID filters must be valid.
- Combined filters use AND semantics.

Database effect: Read-only operation and line query. Category filtering is P1.

## 8. Receipt Endpoints

### POST /receipts

Purpose: Create a Draft receipt.

Authorization: Authenticated.

Parameters: None.

Request body:

- supplierName
- lines: one or more objects containing productId, destinationLocationId, and quantity

Success response: 201 with receipt header, lines, and status DRAFT.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND for unknown products or locations
- 409 CONFLICT for duplicate lines

Validation:

- Supplier name is not blank.
- At least one line is supplied.
- Every product and location exists and is active.
- Every quantity is greater than zero.
- Duplicate product/location lines are rejected.

Database effect:

- Creates a RECEIPT operation in DRAFT.
- Creates the receipt header and lines.
- No stock or ledger effect.

Creation of the operation and all lines is one transaction.

### GET /receipts

Purpose: List receipts.

Authorization: Authenticated.

Parameters:

- status, optional
- locationId, optional
- categoryId, optional
- limit, optional
- cursor, optional

Request body: None.

Success response: 200 with paginated receipt summaries.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation: Supported status and valid UUID filters.

Database effect: Read-only query.

### GET /receipts/:receiptId

Purpose: Return one receipt and its lines.

Authorization: Authenticated.

Parameters: receiptId path parameter.

Request body: None.

Success response: 200 with receipt, supplier, lines, status, and timestamps.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: receiptId must be a valid UUID and reference a receipt.

Database effect: Read-only query.

### PATCH /receipts/:receiptId

Purpose: Edit a Draft receipt.

Authorization: Authenticated.

Parameters: receiptId path parameter.

Request body: Supplier and/or complete replacement line set.

Success response: 200 with the updated Draft receipt.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation:

- Receipt exists and is Draft.
- Lines remain non-empty, valid, positive, and non-duplicated.

Database effect: Updates receipt header and lines. No stock or ledger effect.

### POST /receipts/:receiptId/validate

Purpose: Validate a receipt and increase stock.

Authorization: Authenticated.

Parameters: receiptId path parameter.

Request body: None.

Success response: 200 with status DONE, updated balances, and ledger references.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS or ALREADY_COMPLETED

Validation:

- Receipt is in DRAFT.
- It contains one or more valid lines.
- Products and destination locations exist and are active.
- Quantities are greater than zero.

Transaction behavior:

1. Lock the operation row.
2. Return idempotent success if already DONE.
3. Reject if CANCELED.
4. Lock all affected stock rows in deterministic order.
5. Add every receipt quantity.
6. Insert one positive ledger entry per line.
7. Mark operation DONE.
8. Commit.

Any failure rolls back all stock, ledger, and status changes.

Stock effect:

For each line, destination stock becomes previous stock plus received quantity.

Ledger effect:

One positive RECEIPT entry per receipt line.

Repeated validation: Allowed as an idempotent no-op. It must not add stock or duplicate ledger entries.

### POST /receipts/:receiptId/cancel

Purpose: Cancel a receipt before validation.

Authorization: Authenticated.

Parameters: receiptId path parameter.

Request body: None.

Success response: 200 with status CANCELED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS if already DONE or CANCELED

Validation: Only a Draft receipt may be canceled.

Database effect: Sets operation status to CANCELED. No stock or ledger effect.

## 9. Delivery Endpoints

### POST /deliveries

Purpose: Create a Draft delivery.

Authorization: Authenticated.

Parameters: None.

Request body:

- customerName, optional
- lines: one or more objects containing productId, sourceLocationId, and quantity

Success response: 201 with delivery in DRAFT.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 CONFLICT

Validation:

- At least one line.
- Products and source locations exist and are active.
- Every quantity is greater than zero.
- No duplicate product/source-location line.

Database effect:

- Creates a DELIVERY operation in DRAFT.
- Creates delivery header and lines.
- No stock or ledger effect.

### GET /deliveries

Purpose: List deliveries.

Authorization: Authenticated.

Parameters: status, source location, category, limit, cursor.

Request body: None.

Success response: 200 with paginated delivery summaries.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation: Supported status and valid filters.

Database effect: Read-only query.

### GET /deliveries/:deliveryId

Purpose: Return one delivery and its lines.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: None.

Success response: 200 with delivery, lines, status, and timestamps.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: Valid delivery ID.

Database effect: Read-only query.

### PATCH /deliveries/:deliveryId

Purpose: Edit a delivery before completion.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: Customer name and/or complete line set.

Success response: 200 with updated delivery.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation:

- Delivery is not DONE or CANCELED.
- Lines are non-empty, positive, valid, and non-duplicated.

Database effect: Updates delivery data only. No stock or ledger effect.

### POST /deliveries/:deliveryId/pick

Purpose: Mark a delivery as Picked.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: None.

Success response: 200 with status PICKED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Delivery must be DRAFT.

Database effect: Updates status only. No stock or ledger effect.

### POST /deliveries/:deliveryId/pack

Purpose: Mark a delivery as Packed.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: None.

Success response: 200 with status PACKED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Delivery must be PICKED.

Database effect: Updates status only. No stock or ledger effect.

### POST /deliveries/:deliveryId/validate

Purpose: Validate a Packed delivery and decrease stock.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: None.

Success response: 200 with status DONE, updated balances, and ledger references.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS, ALREADY_COMPLETED, or INSUFFICIENT_STOCK

Validation:

- Delivery is PACKED.
- Every quantity is greater than zero.
- Every source stock balance is sufficient.
- Negative stock is never allowed.

Transaction behavior:

1. Lock the operation row.
2. Return idempotent success if already DONE.
3. Reject if CANCELED or not PACKED.
4. Ensure affected stock rows exist.
5. Lock all source balances in deterministic order.
6. Re-check every source quantity.
7. Subtract all delivery quantities.
8. Insert one negative ledger entry per line.
9. Mark operation DONE.
10. Commit.

Any failure rolls back all changes.

Stock effect:

For each line, source stock becomes previous stock minus delivered quantity.

Ledger effect:

One negative DELIVERY entry per delivery line.

Repeated validation: Allowed as an idempotent no-op only after the first successful completion. It must not deduct stock again.

### POST /deliveries/:deliveryId/cancel

Purpose: Cancel a delivery before validation.

Authorization: Authenticated.

Parameters: deliveryId path parameter.

Request body: None.

Success response: 200 with status CANCELED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS if DONE or CANCELED

Validation: Delivery may be canceled from DRAFT, PICKED, or PACKED.

Database effect: Updates status only. No stock or ledger effect.

## 10. Internal Transfer Endpoints

### POST /transfers

Purpose: Create a Draft internal transfer.

Authorization: Authenticated.

Parameters: None.

Request body:

- lines: one or more objects containing productId, sourceLocationId, destinationLocationId, and quantity

Success response: 201 with transfer in DRAFT.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 CONFLICT

Validation:

- At least one line.
- Products and locations exist and are active.
- Source and destination differ.
- Quantity is greater than zero.
- Duplicate product/source/destination lines are rejected.

Database effect:

- Creates a TRANSFER operation in DRAFT.
- Creates transfer lines.
- No stock or ledger effect.

### GET /transfers

Purpose: List internal transfers.

Authorization: Authenticated.

Parameters: status, location, category, limit, cursor.

Request body: None.

Success response: 200 with paginated transfer summaries.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation: Supported status and valid filters.

Database effect: Read-only query.

### GET /transfers/:transferId

Purpose: Return one transfer and its lines.

Authorization: Authenticated.

Parameters: transferId path parameter.

Request body: None.

Success response: 200 with transfer, lines, status, and timestamps.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: Valid transfer ID.

Database effect: Read-only query.

### PATCH /transfers/:transferId

Purpose: Edit a Draft transfer.

Authorization: Authenticated.

Parameters: transferId path parameter.

Request body: Complete replacement line set.

Success response: 200 with updated transfer.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Transfer is DRAFT; lines are valid, positive, non-duplicated, and use different locations.

Database effect: Updates transfer data only. No stock or ledger effect.

### POST /transfers/:transferId/validate

Purpose: Validate a transfer and move stock between locations.

Authorization: Authenticated.

Parameters: transferId path parameter.

Request body: None.

Success response: 200 with status DONE, source/destination balances, and ledger references.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS, ALREADY_COMPLETED, or INSUFFICIENT_STOCK

Validation:

- Transfer is DRAFT.
- Every quantity is greater than zero.
- Source and destination differ.
- Every source balance is sufficient.

Transaction behavior:

1. Lock the operation row.
2. Return idempotent success if already DONE.
3. Reject if CANCELED.
4. Ensure affected source and destination balance rows exist.
5. Lock all affected balances in deterministic order.
6. Re-check source availability.
7. Subtract source quantities.
8. Add destination quantities.
9. Insert one TRANSFER_OUT and one TRANSFER_IN ledger entry per line.
10. Mark operation DONE.
11. Commit.

Any failure rolls back both sides of every transfer.

Stock effect:

Source becomes source minus quantity. Destination becomes destination plus quantity. Total company stock is unchanged.

Ledger effect:

Two entries per line: negative at source and positive at destination.

Repeated validation: Allowed as an idempotent no-op after successful completion. It must not move stock again.

### POST /transfers/:transferId/cancel

Purpose: Cancel a Draft transfer.

Authorization: Authenticated.

Parameters: transferId path parameter.

Request body: None.

Success response: 200 with status CANCELED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Transfer must be DRAFT.

Database effect: Updates status only. No stock or ledger effect.

## 11. Adjustment Endpoints

### POST /adjustments

Purpose: Create a Draft inventory adjustment.

Authorization: Authenticated.

Parameters: None.

Request body:

- reason
- lines: one or more objects containing productId, locationId, and physicalCountedQuantity

Success response: 201 with adjustment in DRAFT and current recorded quantities.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 CONFLICT

Validation:

- Reason is not blank.
- At least one line.
- Product and location exist and are active.
- Physical count is greater than or equal to zero.
- No duplicate product/location line.

Database effect:

- Creates an ADJUSTMENT operation in DRAFT.
- Creates adjustment lines.
- No stock or ledger effect.

### GET /adjustments

Purpose: List adjustments.

Authorization: Authenticated.

Parameters: status, location, category, limit, cursor.

Request body: None.

Success response: 200 with paginated adjustment summaries.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation: Supported status and valid filters.

Database effect: Read-only query.

### GET /adjustments/:adjustmentId

Purpose: Return one adjustment and its before/after information.

Authorization: Authenticated.

Parameters: adjustmentId path parameter.

Request body: None.

Success response: 200 with adjustment, reason, lines, counts, status, and timestamps.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: Valid adjustment ID.

Database effect: Read-only query.

### PATCH /adjustments/:adjustmentId

Purpose: Edit a Draft adjustment.

Authorization: Authenticated.

Parameters: adjustmentId path parameter.

Request body: Reason and/or complete replacement line set.

Success response: 200 with updated adjustment.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Adjustment is DRAFT; reason and non-negative counts are valid.

Database effect: Updates adjustment data only. No stock or ledger effect.

### POST /adjustments/:adjustmentId/validate

Purpose: Validate a physical count adjustment.

Authorization: Authenticated.

Parameters: adjustmentId path parameter.

Request body: None.

Success response: 200 with status DONE, old quantity, new quantity, difference, and ledger references.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS or ALREADY_COMPLETED

Validation:

- Adjustment is DRAFT.
- Every physical count is greater than or equal to zero.
- Every product/location exists.
- Reason is present.

Transaction behavior:

1. Lock the operation row.
2. Return idempotent success if already DONE.
3. Reject if CANCELED.
4. Ensure and lock each selected stock balance.
5. Read recorded quantities after locking.
6. Calculate each difference.
7. Set each stock balance to its physical count.
8. Populate recorded-before, after, and difference values.
9. Insert one ADJUSTMENT ledger entry per line.
10. Mark operation DONE.
11. Commit.

Any failure rolls back every line.

Stock effect:

For each line:

    stock_after = physical_counted_quantity
    difference = physical_counted_quantity - recorded_quantity_before

Ledger effect:

One signed ADJUSTMENT entry per line.

Repeated validation: Allowed as an idempotent no-op after successful completion. It must not apply the difference again.

### POST /adjustments/:adjustmentId/cancel

Purpose: Cancel a Draft adjustment.

Authorization: Authenticated.

Parameters: adjustmentId path parameter.

Request body: None.

Success response: 200 with status CANCELED.

Error response:

- 401 UNAUTHORIZED
- 404 NOT_FOUND
- 409 INVALID_STATUS

Validation: Adjustment must be DRAFT.

Database effect: Updates status only. No stock or ledger effect.

## 12. Dashboard Endpoints

### GET /dashboard/summary

Purpose: Return the dashboard summary.

Authorization: Authenticated.

Parameters:

- locationId, optional
- categoryId, optional

Request body: None.

Success response: 200 containing:

- total distinct products with stock records
- total units
- low-stock products
- out-of-stock products
- pending receipt count
- pending delivery count
- pending transfer count
- recent activity

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- Optional IDs must be valid.
- Filters use AND semantics.

Database effect: Read-only aggregate queries over products, stock_balances, operations, and stock_ledger.

The dashboard must read current quantities from stock_balances and must not reconstruct current stock by scanning the full ledger.

## 13. Stock Ledger Endpoints

### GET /ledger

Purpose: Return paginated stock movement history.

Authorization: Authenticated.

Parameters:

- productId, optional
- locationId, optional
- operationType, optional
- entryKind, optional
- from, optional timestamp
- to, optional timestamp
- limit, optional
- cursor, optional

Request body: None.

Success response: 200 with ledger entries containing:

- ledger ID
- operation ID
- product
- location
- operation type
- entry kind
- signed quantity
- quantity before
- quantity after
- user
- timestamp

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED

Validation:

- IDs and timestamps must be valid.
- entryKind and operationType must be supported.
- Results use keyset pagination.

Database effect: Read-only query over stock_ledger and related records.

### GET /ledger/:ledgerId

Purpose: Return one ledger entry and its operation context.

Authorization: Authenticated.

Parameters: ledgerId path parameter.

Request body: None.

Success response: 200 with the ledger entry and referenced operation.

Error response:

- 400 VALIDATION_ERROR
- 401 UNAUTHORIZED
- 404 NOT_FOUND

Validation: Valid ledger ID.

Database effect: Read-only query.

## 14. Common Inventory Mutation Rules

All inventory-changing endpoints follow these rules.

### Preconditions

- Authenticated user.
- Operation exists for validation, editing, or cancellation.
- Operation type matches the endpoint.
- Operation is in an allowed state.
- Referenced products and locations exist and are active.
- Movement quantities are greater than zero.
- Adjustment physical counts are greater than or equal to zero.
- Multi-line operations contain at least one line.

### Transaction Boundary

The final validation transaction contains:

1. Operation row lock.
2. Status check.
3. Complete line validation.
4. Creation and locking of all affected stock balance rows.
5. Availability re-check using locked values.
6. All stock updates.
7. All ledger inserts.
8. Operation update to DONE.
9. Commit.

Any failure rolls back all changes.

### Idempotency

If validation is repeated after DONE:

- Return the already-completed result.
- Do not modify stock.
- Do not create ledger rows.

The operation row lock and database ledger idempotency constraint are both required.

### Ledger Creation

Only successful validation creates ledger entries. Draft, Picked, Packed, and Canceled operations create no stock ledger movements.

### Atomicity

A multi-line operation either applies every line or applies none. Partial stock and partial ledger updates are forbidden.

## 15. HTTP Status Summary

| Situation | Status |
|---|---:|
| Successful creation | 201 |
| Successful read or mutation | 200 |
| Successful logout/cancel with no body | 204 or 200 |
| Invalid request | 400 |
| Missing/invalid session | 401 |
| Resource not found | 404 |
| Business conflict or invalid state | 409 |
| Unexpected server failure | 500 |

## 16. Explicitly Out of Scope

The API must not add endpoints for:

- General sign-up in the MVP
- Product deletion
- Location creation or deletion
- Warehouse administration
- Supplier CRUD
- Customer CRUD
- Purchase orders
- Sales orders
- Barcode scanning
- Batch or serial tracking
- Inventory valuation
- Negative-stock configuration
- Partial receipt or delivery completion
- Real email or SMS OTP delivery
- Offline mutation queues
- External ERP integrations

## 17. Canonical Integration Contract

This section is normative and supersedes any earlier ambiguous wording in this document.

### 17.1 Canonical Field Names

The API uses these names consistently:

- productId
- categoryId
- warehouseId
- locationId
- sourceLocationId
- destinationLocationId
- operationId
- operationType
- operationStatus
- operationLineId
- ledgerEntryId
- createdAt
- updatedAt
- completedAt
- canceledAt
- createdBy
- completedBy
- canceledBy

The API uses operationStatus values in uppercase:

- DRAFT
- PICKED
- PACKED
- DONE
- CANCELED

The API uses operationType values:

- RECEIPT
- DELIVERY
- TRANSFER
- ADJUSTMENT

OPENING is an internal operation type used only when product creation includes initial stock. It is not a public operation-creation endpoint.

### 17.2 Canonical Quantity Format

All quantity fields are decimal strings, not JavaScript floating-point numbers.

This applies to:

- quantity
- reorderThreshold
- initialStock.quantity
- physicalCountedQuantity
- quantityDelta
- quantityBefore
- quantityAfter
- totalQuantity

Valid movement quantity format:

    A non-negative decimal with at most three fractional digits

Movement quantities for receipts, deliveries, transfers, and opening stock must be greater than zero. Adjustment physicalCountedQuantity may be zero. Adjustment quantityDelta may be positive, negative, or zero.

The frontend must not use binary floating-point arithmetic to calculate authoritative stock values.

### 17.3 Canonical Resource Representations

#### Product

A product response contains:

- id
- sku
- name
- category: object with id and name
- unitOfMeasure
- reorderThreshold
- isActive
- totalQuantity
- stockStatus
- createdAt
- updatedAt

stockStatus is one of:

- NORMAL
- LOW_STOCK
- OUT_OF_STOCK

#### Location Stock

A stock balance contains:

- productId
- locationId
- warehouseId
- quantity
- productTotalQuantity
- stockStatus
- updatedAt

#### Operation

Every operation response contains:

- operationId
- operationType
- operationStatus
- createdBy
- completedBy, nullable
- canceledBy, nullable
- createdAt
- updatedAt
- completedAt, nullable
- canceledAt, nullable
- lines

Each line contains operationLineId, productId, quantity, and operation-specific location fields.

Receipt line:

- destinationLocationId

Delivery line:

- sourceLocationId

Transfer line:

- sourceLocationId
- destinationLocationId

Adjustment line:

- locationId
- physicalCountedQuantity
- recordedQuantityBefore, nullable until DONE
- stockQuantityAfter, nullable until DONE
- difference, nullable until DONE

#### Ledger Entry

Every ledger response contains:

- ledgerEntryId
- operationId
- operationLineId
- operationType
- entryKind
- productId
- locationId
- quantityDelta
- quantityBefore
- quantityAfter
- createdBy
- createdAt

entryKind is one of:

- RECEIPT
- DELIVERY
- TRANSFER_OUT
- TRANSFER_IN
- ADJUSTMENT
- OPENING

operationLineId is the originating line ID regardless of the operation type. The API does not expose the database's multiple nullable line-reference columns.

### 17.4 Canonical Stock Read Endpoint

GET /products/:productId/stock and GET /stock?productId= return overlapping information.

The canonical endpoint is:

    GET /stock?productId={productId}

It returns location balances and productTotalQuantity.

GET /products/:productId/stock is a compatibility alias only. It must not implement different filtering, response fields, or authorization behavior. A new frontend must use GET /stock.

### 17.5 Canonical Product Search

GET /products supports search by name or SKU through the single query parameter:

    search

Search behavior:

- Case-insensitive.
- Partial matching is allowed.
- Empty search returns the normal product list.
- Results are ordered by name, then product ID.

The backend performs the search. The frontend must not download all products to filter locally.

### 17.6 Canonical Filter Names

All operation list endpoints use:

- status
- operationType where applicable
- locationId
- categoryId
- limit
- cursor

Delivery lists use locationId to mean the delivery source location. Transfer lists match an operation when locationId is either the source or destination location.

Receipt lists match locationId against destination locations. Adjustment lists match locationId against adjustment locations.

All supplied filters use AND semantics.

The single-warehouse MVP does not expose a required warehouse filter. warehouseId may be accepted only as an optional read filter and must return the single configured warehouse.

### 17.7 Canonical Error Responses

Every endpoint must document and return these applicable errors:

- 400 VALIDATION_ERROR for malformed IDs, invalid quantity format, invalid query values, missing fields, or invalid line structure.
- 401 UNAUTHORIZED for missing or invalid session.
- 404 NOT_FOUND when the requested resource does not exist.
- 409 CONFLICT for duplicate SKU, duplicate operation line, inactive product/location, or database uniqueness conflict.
- 409 INVALID_STATUS for an invalid status transition.
- 409 INSUFFICIENT_STOCK when delivery or transfer availability fails.
- 409 ALREADY_COMPLETED when the client explicitly requests a second completion and the API does not use the idempotent success response.
- 500 INTERNAL_ERROR for unexpected failures.

Validation errors identify fields using the same camelCase names as the request body.

### 17.8 Authentication and State-Changing Requests

All protected endpoints require the authenticated HTTP-only session cookie.

All state-changing requests also require:

- Same-origin or approved frontend Origin.
- CSRF protection appropriate to the cookie-based session.
- Content-Type application/json when a body is present.

The frontend must not send a user ID, createdBy value, completedBy value, or ledger user value as authoritative input. The backend derives these values from the session.

### 17.9 Operation References

The operation reference is always operationId. The source line reference is always operationLineId.

Validation responses must return:

- operationId
- operationType
- operationStatus
- completedAt
- affected stock balances
- created ledgerEntryId values

The frontend must use operationId when navigating to a document and ledgerEntryId when opening a movement history entry.

### 17.10 Corrected Mutation Preconditions

For every validate endpoint, the backend must lock the operation row before checking status.

If the operation is DONE:

- Return the existing completed representation.
- Do not modify stock.
- Do not create ledger entries.

If the operation is CANCELED:

- Return 409 INVALID_STATUS.
- Do not modify stock.
- Do not create ledger entries.

Otherwise the operation must be in its required validation state:

- Receipt: DRAFT.
- Delivery: PACKED.
- Transfer: DRAFT.
- Adjustment: DRAFT.

### 17.11 Corrected Delivery Editing Rules

PATCH /deliveries/:deliveryId is allowed only when the delivery is DRAFT.

Picked and Packed deliveries cannot have their lines edited. This avoids changing a document after warehouse preparation has started.

If a delivery must be changed after picking, it must be canceled and recreated. No stock is changed by cancellation.

### 17.12 Corrected Inventory Effects

Receipt validation:

    destination stock after = destination stock before + quantity

Delivery validation:

    source stock after = source stock before - quantity

Transfer validation:

    source stock after = source stock before - quantity
    destination stock after = destination stock before + quantity
    total product stock after = total product stock before

Adjustment validation:

    stock after = physicalCountedQuantity
    difference = physicalCountedQuantity - quantityBefore

Picking, packing, Draft, and Canceled statuses never change stock or create ledger entries.

### 17.13 Corrected Transaction Requirement

The final validation transaction must contain all of the following:

1. Operation status lock and idempotency check.
2. Complete line validation.
3. Creation and locking of every affected stock balance row.
4. Availability re-check using locked quantities.
5. All stock balance updates.
6. All ledger inserts.
7. Before/after values for adjustments.
8. Final operation status update to DONE.
9. Commit.

If one line fails, all stock changes, ledger entries, before/after values, and status changes are rolled back.

### 17.14 Missing Endpoint Assessment

No additional P0 endpoint is required for the approved scope.

The existing resource detail endpoints cover operation lookup:

- GET /receipts/:receiptId
- GET /deliveries/:deliveryId
- GET /transfers/:transferId
- GET /adjustments/:adjustmentId

GET /operations is the canonical cross-operation search endpoint. A separate GET /operations/:operationId endpoint is intentionally not added because it would duplicate the type-specific detail endpoints.

No category-management, location-management, warehouse-management, supplier-management, or customer-management endpoints are added.

### 17.15 Duplicate Endpoint Resolution

The contract contains one intentional compatibility alias:

- Canonical: GET /stock?productId={productId}
- Alias: GET /products/:productId/stock

The alias may be removed if no frontend client depends on it. All other list and detail endpoints have distinct responsibilities.
