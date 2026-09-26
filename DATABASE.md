# StockSense PostgreSQL Database Design

## 1. Purpose and Scope

PostgreSQL is the authoritative source of truth for StockSense. The design supports one warehouse with multiple locations, products, categories, receipts, deliveries, internal transfers, adjustments, current stock balances, and an append-only stock ledger.

The database must support:

- Traceable stock by product and location.
- Auditing of every stock-changing operation.
- Draft and Canceled operations with no stock effect.
- Idempotent validation.
- Atomic multi-line operations.
- Non-negative stock in the MVP.
- Efficient dashboard, product, operation, and ledger queries.

The schema uses numeric(18,3) for quantities and timestamptz for timestamps. Floating-point types must not be used for stock.

## 2. Tables

### users

Purpose: authenticated users who create operations and ledger entries.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| email | text | Not null |
| password_hash | text | Not null |
| display_name | text | Not null |
| is_active | boolean | Not null, default true |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |

Constraints and indexes:

- Unique case-insensitive email index on lower(email).
- Display name must not be empty.
- Index on is_active.

Relationships and delete behavior:

- Referenced by inventory_operations and stock_ledger.
- Referenced by password_reset_tokens.
- Users must not be deleted while referenced by operations or ledger entries.
- Deactivate users instead.

### password_reset_tokens

Purpose: optional P1 support for mocked OTP password reset.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| user_id | uuid | Not null, foreign key to users |
| otp_hash | text | Not null |
| expires_at | timestamptz | Not null |
| consumed_at | timestamptz | Nullable |
| created_at | timestamptz | Not null, default now() |

Constraints and indexes:

- expires_at must be later than created_at.
- Index on user_id and created_at descending.
- Index on expires_at.
- A consumed token cannot be reused.

Delete behavior:

- user_id uses ON DELETE CASCADE because reset tokens have no audit value.

### categories

Purpose: product categories.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| name | text | Not null |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |

Constraints and indexes:

- Category name must not be empty.
- Unique case-insensitive index on lower(name).

Delete behavior:

- A category referenced by a product cannot be deleted.
- Renaming is allowed.

### warehouses

Purpose: warehouse boundary for locations. The MVP creates one warehouse but retains this entity for future expansion.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| code | text | Not null |
| name | text | Not null |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |

Constraints and indexes:

- Code must be unique case-insensitively.
- Name must not be empty.
- Unique index on lower(code).

Delete behavior:

- A warehouse referenced by locations or operations cannot be deleted.
- Warehouse identity is immutable.

### locations

Purpose: physical or logical stock locations within a warehouse.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| warehouse_id | uuid | Not null, foreign key to warehouses |
| code | text | Not null |
| name | text | Not null |
| is_active | boolean | Not null, default true |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |

Constraints and indexes:

- Name and code must not be empty.
- Location code is unique within a warehouse, case-insensitively.
- Location name is unique within a warehouse, case-insensitively.
- Unique indexes on warehouse_id plus lower(code) and warehouse_id plus lower(name).
- Index on warehouse_id.

Delete behavior:

- A location referenced by stock, operations, or ledger history cannot be deleted.
- Deactivate it with is_active false.
- A used location cannot be moved to another warehouse.

### products

Purpose: product master data and reorder configuration.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| sku | text | Not null |
| name | text | Not null |
| category_id | uuid | Not null, foreign key to categories |
| unit_of_measure | text | Not null |
| reorder_threshold | numeric(18,3) | Not null, default 0 |
| is_active | boolean | Not null, default true |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |

Constraints and indexes:

- Name, SKU, and unit_of_measure must not be empty.
- SKU must be unique case-insensitively.
- reorder_threshold must be greater than or equal to zero.
- Unique index on lower(sku).
- Index on category_id.
- Index suitable for name search.

Delete behavior:

- Products must not be deleted after use.
- Deactivate products with is_active false.
- Category changes are allowed.

Optional initial stock is represented by an opening operation, not a mutable product quantity column.

### inventory_operations

Purpose: common header for receipts, deliveries, transfers, adjustments, and opening stock.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| operation_type | text | Not null |
| status | text | Not null, default DRAFT |
| created_by | uuid | Not null, foreign key to users |
| completed_by | uuid | Nullable, foreign key to users |
| canceled_by | uuid | Nullable, foreign key to users |
| created_at | timestamptz | Not null, default now() |
| updated_at | timestamptz | Not null, default now() |
| completed_at | timestamptz | Nullable |
| canceled_at | timestamptz | Nullable |

Allowed operation types:

- RECEIPT
- DELIVERY
- TRANSFER
- ADJUSTMENT
- OPENING

Allowed statuses:

- DRAFT
- PICKED
- PACKED
- DONE
- CANCELED

Constraints:

- operation_type and status must use the allowed values.
- completed_at and completed_by are required for DONE.
- canceled_at and canceled_by are required for CANCELED.
- DONE cannot have cancellation fields.
- CANCELED cannot have completion fields.

Indexes:

- Composite index on status, operation_type, created_at descending.
- Index on created_by and created_at descending.
- Partial index for statuses other than DONE and CANCELED.

Delete/update behavior:

- Operations are never deleted.
- Draft operations may be edited.
- Done and Canceled operations are immutable.
- Status changes occur only inside the operation transaction.

### receipts

Purpose: receipt-specific data for incoming stock.

Columns:

| Column | Type | Rules |
|---|---|---|
| operation_id | uuid | Primary key, foreign key to inventory_operations |
| supplier_name | text | Not null |

Constraints:

- The referenced operation must have type RECEIPT.
- supplier_name must not be empty.

Delete/update behavior:

- Supplier name may be edited while Draft.
- It is immutable after completion.
- Operation deletion is restricted.

### receipt_lines

Purpose: product quantities received into destination locations.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| receipt_id | uuid | Not null, foreign key to receipts.operation_id |
| product_id | uuid | Not null, foreign key to products |
| destination_location_id | uuid | Not null, foreign key to locations |
| quantity | numeric(18,3) | Not null |
| created_at | timestamptz | Not null, default now() |

Constraints and indexes:

- quantity must be greater than zero.
- Unique receipt_id, product_id, destination_location_id.
- Indexes on receipt_id, product_id, and destination_location_id.

Delete/update behavior:

- Lines may be edited only while the receipt is Draft.
- Lines cannot be edited or deleted after completion.

### deliveries

Purpose: delivery-specific data for outgoing stock.

Columns:

| Column | Type | Rules |
|---|---|---|
| operation_id | uuid | Primary key, foreign key to inventory_operations |
| customer_name | text | Nullable |

Constraints:

- The referenced operation must have type DELIVERY.

Delete/update behavior:

- customer_name is optional because customer management is out of scope.
- Fields may be edited before completion.
- Operation deletion is restricted.

### delivery_lines

Purpose: product quantities delivered from source locations.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| delivery_id | uuid | Not null, foreign key to deliveries.operation_id |
| product_id | uuid | Not null, foreign key to products |
| source_location_id | uuid | Not null, foreign key to locations |
| quantity | numeric(18,3) | Not null |
| created_at | timestamptz | Not null, default now() |

Constraints and indexes:

- quantity must be greater than zero.
- Unique delivery_id, product_id, source_location_id.
- Indexes on delivery_id, product_id, and source_location_id.

Delete/update behavior:

- Lines may be edited before the delivery reaches DONE.
- Lines cannot be edited after DONE or CANCELED.

### transfers

Purpose: transfer-specific operation header.

Columns:

| Column | Type | Rules |
|---|---|---|
| operation_id | uuid | Primary key, foreign key to inventory_operations |

Constraints:

- The referenced operation must have type TRANSFER.

Delete/update behavior:

- Operation deletion is restricted.
- Transfer details are immutable after DONE or CANCELED.

### transfer_lines

Purpose: product quantities moved between locations.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| transfer_id | uuid | Not null, foreign key to transfers.operation_id |
| product_id | uuid | Not null, foreign key to products |
| source_location_id | uuid | Not null, foreign key to locations |
| destination_location_id | uuid | Not null, foreign key to locations |
| quantity | numeric(18,3) | Not null |
| created_at | timestamptz | Not null, default now() |

Constraints and indexes:

- quantity must be greater than zero.
- Source and destination must be different.
- Unique transfer_id, product_id, source_location_id, destination_location_id.
- Indexes on transfer_id, product_id, source_location_id, and destination_location_id.

Delete/update behavior:

- Lines may be edited while Draft.
- Lines cannot be edited after DONE or CANCELED.

### adjustments

Purpose: adjustment-specific operation header and reason.

Columns:

| Column | Type | Rules |
|---|---|---|
| operation_id | uuid | Primary key, foreign key to inventory_operations |
| reason | text | Not null |

Constraints:

- The referenced operation must have type ADJUSTMENT.
- reason must not be empty.

Delete/update behavior:

- Reason may be edited while Draft.
- Reason is immutable after DONE or CANCELED.

### adjustment_lines

Purpose: physical counts and before/after values.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| adjustment_id | uuid | Not null, foreign key to adjustments.operation_id |
| product_id | uuid | Not null, foreign key to products |
| location_id | uuid | Not null, foreign key to locations |
| physical_counted_quantity | numeric(18,3) | Not null |
| recorded_quantity_before | numeric(18,3) | Nullable until completion |
| stock_quantity_after | numeric(18,3) | Nullable until completion |
| difference | numeric(18,3) | Nullable until completion |
| created_at | timestamptz | Not null, default now() |

Constraints and indexes:

- physical_counted_quantity must be greater than or equal to zero.
- Unique adjustment_id, product_id, location_id.
- Indexes on adjustment_id, product_id, and location_id.
- On completion, stock_quantity_after equals physical_counted_quantity.
- On completion, difference equals physical_counted_quantity minus recorded_quantity_before.

Delete/update behavior:

- Draft lines may be edited.
- Completed lines are immutable.

### opening_stock_lines

Purpose: represents optional initial stock supplied during product creation.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| operation_id | uuid | Not null, foreign key to inventory_operations |
| product_id | uuid | Not null, foreign key to products |
| location_id | uuid | Not null, foreign key to locations |
| quantity | numeric(18,3) | Not null |

Constraints and indexes:

- The operation must have type OPENING and status DONE.
- quantity must be greater than zero.
- Unique operation_id, product_id, location_id.
- Indexes on operation_id, product_id, and location_id.

Delete/update behavior:

- Opening stock is immutable and cannot be deleted independently.

This table makes initial stock auditable. If the team decides initial stock should be represented as an adjustment instead, this table can be removed.

### stock_balances

Purpose: current quantity for each product/location pair.

Columns:

| Column | Type | Rules |
|---|---|---|
| product_id | uuid | Not null, foreign key to products |
| location_id | uuid | Not null, foreign key to locations |
| quantity | numeric(18,3) | Not null, default 0 |
| updated_at | timestamptz | Not null, default now() |

Primary key:

- Composite primary key on product_id, location_id.

Constraints and indexes:

- quantity must be greater than or equal to zero.
- Primary key supports product/location reads.
- Index on location_id, product_id.
- Optional partial index on product_id and quantity where quantity is greater than zero.

Delete/update behavior:

- Rows are created when a product/location pair is first used.
- Rows are changed only by transactional stock operations.
- Rows cannot be deleted while ledger history exists.

### stock_ledger

Purpose: append-only audit trail for every stock change.

Columns:

| Column | Type | Rules |
|---|---|---|
| id | uuid | Primary key |
| operation_id | uuid | Not null, foreign key to inventory_operations |
| product_id | uuid | Not null, foreign key to products |
| location_id | uuid | Not null, foreign key to locations |
| entry_kind | text | Not null |
| quantity_delta | numeric(18,3) | Not null |
| quantity_before | numeric(18,3) | Not null |
| quantity_after | numeric(18,3) | Not null |
| receipt_line_id | uuid | Nullable, foreign key to receipt_lines |
| delivery_line_id | uuid | Nullable, foreign key to delivery_lines |
| transfer_line_id | uuid | Nullable, foreign key to transfer_lines |
| adjustment_line_id | uuid | Nullable, foreign key to adjustment_lines |
| opening_line_id | uuid | Nullable, foreign key to opening_stock_lines |
| created_by | uuid | Not null, foreign key to users |
| created_at | timestamptz | Not null, default now() |

Allowed entry_kind values:

- RECEIPT
- DELIVERY
- TRANSFER_OUT
- TRANSFER_IN
- ADJUSTMENT
- OPENING

Constraints:

- quantity_before and quantity_after must be greater than or equal to zero.
- quantity_after equals quantity_before plus quantity_delta.
- RECEIPT, TRANSFER_IN, and OPENING require a positive quantity_delta.
- DELIVERY and TRANSFER_OUT require a negative quantity_delta.
- ADJUSTMENT may be positive, negative, or zero.
- Exactly one operation-line reference must be non-null.
- entry_kind must match the referenced line type. The operation service must enforce this, with an optional trigger for defense in depth.

Indexes:

- Index on product_id, location_id, created_at descending.
- Index on operation_id, created_at.
- Index on location_id, created_at descending.
- Index on created_by, created_at descending.
- Unique idempotency index on operation_id, entry_kind, product_id, location_id.

Delete/update behavior:

- Ledger entries are append-only.
- Completed entries cannot be edited or deleted.
- Foreign-key deletes use RESTRICT.

The idempotency index prevents duplicate movements for a completed operation. The operation row must also be locked during validation.

## 3. Cross-Table Integrity Rules

Some rules require the operation service and transaction because ordinary CHECK constraints cannot safely inspect other tables.

### Operation type and detail table

- RECEIPT operations have one receipt header.
- DELIVERY operations have one delivery header.
- TRANSFER operations have one transfer header.
- ADJUSTMENT operations have one adjustment header.
- OPENING operations have opening lines.

### Operation status and ledger

- Only DONE operations may have ledger entries.
- DRAFT and CANCELED operations must not have ledger entries.
- A DONE operation cannot change stock more than once.

### Stock and ledger

For every ledger entry:

quantity_after = quantity_before + quantity_delta

The related stock balance must equal the current quantity after all committed entries for that product/location.

### Transfer conservation

For every completed transfer line:

source_delta + destination_delta = 0

Therefore total company stock is unchanged.

## 4. Transaction Boundaries

### Draft creation

Create an operation and its lines in one transaction. A failed line insert must not leave an incomplete operation.

### Preparation status

Changing a delivery from Draft to Picked or Packed changes only operation status. It must not touch stock or the ledger.

### Final validation

Receipt, delivery, transfer, adjustment, and opening-stock completion must use one transaction containing:

1. Operation row lock.
2. Status and line validation.
3. Affected stock row locks.
4. Stock balance updates.
5. Ledger inserts.
6. Operation status update to DONE.
7. Commit.

Any failure rolls back all changes.

## 5. Normalization Decisions

The design is normalized around separate entities:

- Categories are separate from products.
- Warehouses are separate from locations.
- Operation headers are separate from operation lines.
- Receipts, deliveries, transfers, and adjustments have type-specific tables.
- Current stock is separate from historical ledger entries.
- Users are separate from audit records.

The current stock balance is intentionally maintained as a read-optimized projection. It avoids recalculating the entire ledger for every stock read while preserving the ledger as the audit trail.

Do not store a mutable total-stock column on products. Product totals are derived from stock_balances.

## 6. Important Indexes and Query Patterns

Required indexes:

- Case-insensitive unique SKU index.
- Category foreign-key index.
- Warehouse/location ownership indexes.
- Stock balance primary key on product/location.
- Reverse stock balance index on location/product.
- Operation status/type/time index.
- Pending-operation partial index.
- Operation-line foreign-key indexes.
- Ledger product/location/time index.
- Ledger operation/time index.
- Ledger idempotency unique index.

These indexes support:

- Product search by SKU or name.
- Stock by product.
- Stock by location.
- Dashboard counts by status.
- Ledger history by product and location.
- Operation detail pages by operation ID.

Dashboard queries should:

- Count distinct products with stock records.
- Sum stock quantities across locations.
- Find products with total stock equal to zero.
- Find products with positive total stock at or below the reorder threshold.
- Count receipts, deliveries, and transfers not in DONE or CANCELED.
- List recent ledger activity.
- List balances for a product by location.

## 7. Scalability Considerations

The warehouse/location relationship supports future warehouses without redesigning stock identity.

For larger data volumes:

- Paginate ledger and operation history.
- Keep stock balance rows narrow.
- Match composite indexes to query predicates.
- Partition or archive the ledger only when volume requires it.
- Keep transaction lock order deterministic.
- Use PostgreSQL connection pooling.
- Avoid recalculating product totals from the entire ledger.

Do not introduce sharding, event-sourcing infrastructure, or microservices for the MVP.

## TABLE RELATIONSHIP OVERVIEW

    users
      |--< inventory_operations
      |--< stock_ledger
      |--< password_reset_tokens

    categories
      |--< products

    warehouses
      |--< locations

    products
      |--< receipt_lines
      |--< delivery_lines
      |--< transfer_lines
      |--< adjustment_lines
      |--< opening_stock_lines
      |--< stock_balances
      |--< stock_ledger

    locations
      |--< receipt_lines
      |--< delivery_lines
      |--< transfer_lines
      |--< adjustment_lines
      |--< opening_stock_lines
      |--< stock_balances
      |--< stock_ledger

    inventory_operations
      |-- receipts --< receipt_lines
      |-- deliveries --< delivery_lines
      |-- transfers --< transfer_lines
      |-- adjustments --< adjustment_lines
      |-- opening_stock_lines
      |--< stock_ledger

## ER DIAGRAM DESCRIPTION

1. A warehouse owns many locations.
2. A category contains many products.
3. A product has many stock balance rows, one for each location where it is tracked.
4. An inventory operation has one type-specific header.
5. A receipt has many receipt lines, each adding stock to a destination location.
6. A delivery has many delivery lines, each removing stock from a source location.
7. A transfer has many transfer lines, each connecting a source and destination.
8. An adjustment has many lines, each storing a physical count and before/after values.
9. An opening operation has opening-stock lines for optional initial quantities.
10. Every completed operation produces one or more ledger entries.
11. Every ledger entry belongs to one product, location, operation, and user.
12. Stock balances store current quantities; ledger entries explain them.

## 8. Delete and Update Policy Summary

- Master records used by history are deactivated rather than deleted.
- Draft operations and lines may be edited.
- Done and Canceled operations are immutable.
- Stock balances change only through transactional validation.
- Ledger entries are append-only.
- Foreign-key deletes for historical records use RESTRICT.
- Password reset tokens may be deleted with their user.

## 9. Database Implementation Notes

Column constraints reject impossible individual values. Unique constraints prevent duplicate identities and duplicate lines. Foreign keys preserve references. Transactions enforce atomic multi-table changes. Row locks protect concurrent validation. The operation service enforces status transitions and operation-type relationships.

The database should be initialized with one warehouse and at least two active locations for the demo lifecycle.

## 10. Normative Database Corrections

This section overrides any earlier wording that describes a protection only in prose. The following rules are required in the actual PostgreSQL migration and transaction implementation.

### 10.1 Required Database Constraints

Create named constraints for:

- Case-insensitive, trimmed, unique SKU.
- Non-blank product, category, warehouse, location, supplier, and reason values.
- Receipt, delivery, transfer, and opening quantities greater than zero.
- Adjustment physical counts greater than or equal to zero.
- Stock balance quantities greater than or equal to zero.
- Ledger before and after quantities greater than or equal to zero.
- Reorder thresholds greater than or equal to zero.
- Transfer source and destination locations being different.
- Allowed operation types, operation statuses, and ledger entry kinds.
- Ledger quantity arithmetic:

      quantity_after = quantity_before + quantity_delta

The quantity restrictions must be database CHECK constraints, not only request validation.

### 10.2 Explicit Foreign-Key Delete Behavior

All foreign keys from historical records must explicitly use ON DELETE RESTRICT, including:

- Product references from operation lines, stock balances, and stock ledger.
- Location references from operation lines, stock balances, and stock ledger.
- Operation references from type-specific headers, lines, and stock ledger.
- User references from operations and stock ledger.
- Category references from products.
- Warehouse references from locations.

Products, locations, warehouses, categories, users, operations, and completed history are not deleted through the MVP application. Master records are deactivated where applicable.

The only intentional cascade is password_reset_tokens.user_id, because reset tokens have no historical audit value.

### 10.3 Operation Type and Status Enforcement

The operation status constraint must prevent preparation statuses on non-deliveries:

- DELIVERY may use DRAFT, PICKED, PACKED, DONE, or CANCELED.
- RECEIPT, TRANSFER, ADJUSTMENT, and OPENING may use DRAFT, DONE, or CANCELED.

Status transitions are backend rules executed while the operation row is locked. The database may additionally enforce them with a trigger.

Each operation type must have exactly its matching detail structure:

- RECEIPT has one receipt header.
- DELIVERY has one delivery header.
- TRANSFER has one transfer header.
- ADJUSTMENT has one adjustment header.
- OPENING has opening lines.

Ordinary foreign keys do not enforce this type relationship. The backend must enforce it, and a deferred constraint trigger is recommended if direct database writes must also be protected.

### 10.4 Ledger Reference Integrity

The stock ledger must contain exactly one originating line reference:

- receipt_line_id
- delivery_line_id
- transfer_line_id
- adjustment_line_id
- opening_line_id

The migration must create a CHECK constraint requiring the number of non-null references to equal one.

The entry kind must match the reference:

- RECEIPT references receipt_lines.
- DELIVERY references delivery_lines.
- TRANSFER_OUT and TRANSFER_IN reference transfer_lines.
- ADJUSTMENT references adjustment_lines.
- OPENING references opening_stock_lines.

This cross-table rule must be enforced by the backend transaction and should be protected by a deferred constraint trigger.

### 10.5 Idempotency Key

The idempotency rule must not rely only on operation_id, entry_kind, product_id, and location_id. The originating line identity must be included so legitimate distinct lines cannot collide.

Use a unique expression index based on:

      operation_id
      entry_kind
      originating_line_id

where originating_line_id is the one non-null line reference. For transfers, TRANSFER_OUT and TRANSFER_IN remain distinct entry kinds.

The operation row must be locked before the status is checked. If it is already DONE, validation returns without changing stock or inserting ledger entries.

### 10.6 Safe Concurrent Stock Access

The validation transaction must:

1. Lock the operation row.
2. Ensure every affected stock_balances row exists.
3. Lock every affected stock_balances row.
4. Lock rows in deterministic product/location order.
5. Re-check stock availability using the locked values.
6. Apply all balances and ledger entries in the same transaction.

If a stock balance row does not exist, the insert-or-lock sequence must prevent two concurrent requests from creating competing authoritative rows.

### 10.7 Atomic Validation Boundary

The following must be one PostgreSQL transaction:

- Operation status check.
- All line validation.
- All stock balance locks.
- All stock balance updates.
- All ledger inserts.
- Final operation status update to DONE.

If any part fails, all parts roll back. A transaction covering only stock updates is insufficient.

### 10.8 Adjustment Rules

Adjustment physical counts may be zero. Movement quantities for receipts, deliveries, transfers, and opening stock may not be zero.

For a completed adjustment:

      stock_quantity_after = physical_counted_quantity
      difference = physical_counted_quantity - recorded_quantity_before

The backend transaction must populate and verify recorded_quantity_before, stock_quantity_after, and difference. A deferred constraint trigger may provide additional protection.

Zero-difference adjustment ledger behavior remains a product decision. The schema permits a zero adjustment ledger entry for audit purposes.

### 10.9 Stock and Ledger Reconciliation

The database cannot enforce the relationship between stock_balances and stock_ledger with an ordinary CHECK constraint because it spans tables.

The backend must update both in the same transaction. Provide a reconciliation query or administrative diagnostic that compares:

      current stock balance
      against
      opening movements
      + receipt movements
      - delivery movements
      + transfer movements
      + adjustment differences

### 10.10 Ledger Indexes and Pagination

In addition to the existing indexes, create:

- An index on created_at descending, id descending for global recent activity.
- Product/location/time index for product history.
- Operation/time index for operation drill-down.
- Idempotency unique index using the originating line identity.

Ledger and operation history must use keyset pagination based on created_at and id. Unbounded ledger queries are prohibited.

### 10.11 Dashboard Query Rule

Dashboard queries must read current quantities from stock_balances. They must not calculate current stock by scanning the entire stock_ledger.

The dashboard service should use one endpoint and a small fixed set of indexed aggregate queries for:

- Distinct products with stock records.
- Total units across locations.
- Low-stock and out-of-stock products.
- Pending receipts, deliveries, and transfers.
- Recent ledger activity.

### 10.12 Responsibility Boundary

Database constraints protect row-level invariants and identity. Backend transactions protect cross-row business rules:

Database:

- Foreign keys
- Unique constraints
- Quantity checks
- Non-negative balances
- Same-location rejection
- Ledger arithmetic
- Ledger reference cardinality

Backend plus database transaction:

- Delivery availability
- Transfer availability
- Operation status transitions
- Operation type/detail consistency
- Ledger entry kind consistency
- Idempotent validation
- Atomic multi-line completion
- Stock/ledger synchronization

These responsibilities must not be left as frontend-only behavior.
