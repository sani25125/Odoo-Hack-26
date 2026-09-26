# StockSense Domain Rules

## 1. Scope

These rules define the StockSense MVP domain behavior.

The MVP supports one warehouse, multiple locations, products, receipts, deliveries, internal transfers, inventory adjustments, a stock ledger, operation statuses, and stock alerts.

The MVP does not support negative stock, product deletion, full multi-warehouse behavior, partial operation completion, real OTP delivery, inventory valuation, unit conversion, or external integrations.

Items marked **Decision Needed** are not fully defined by the source documents.

## 2. Domain Notation

Let:

- `P` = a product
- `L` = a location
- `S(P, L)` = stock quantity of product `P` at location `L`
- `T(P)` = total stock of product `P`
- `Q` = an operation-line quantity
- `C(P, L)` = physical counted quantity
- `D(P, L)` = adjustment difference

Total product stock is:

```text
T(P) = sum of S(P, L) for every location L
```

For the MVP:

```text
S(P, L) >= 0
```

All stock quantities use the product's unit of measure.

## 3. Products

Every product must have:

- Name
- Unique SKU or product code
- Category
- Unit of measure
- Reorder threshold
- Optional initial stock

Rules:

1. SKU must be unique across all products.
2. A product cannot be created without a name, SKU, category, and unit of measure.
3. A product may be updated.
4. A product must not be deleted in the MVP.
5. A product may have zero stock.
6. A product may have stock at multiple locations.
7. Product stock is calculated from location balances.
8. Initial stock, if provided, must be non-negative.
9. Initial stock must be assigned to a location before it affects location stock.

**Decision Needed:** The source documents do not specify which location receives initial stock. Recommended MVP rule: initial stock must include an explicit location.

## 4. Locations

1. The MVP contains one warehouse.
2. The warehouse contains multiple locations.
3. Suggested locations are `Main Store`, `Production Rack`, and `Dispatch`.
4. Stock is tracked by product and location.
5. Transfer source and destination locations must belong to the supported warehouse.
6. A transfer source and destination cannot be the same location.
7. A location must not be deleted if it has stock or ledger history.

The final deletion rule protects historical integrity. The source documents do not otherwise define location deletion behavior.

## 5. Stock Quantities

1. Stock is maintained separately for each product and location.
2. Stock quantities must never be negative in the MVP.
3. Receipt, delivery, and transfer movement quantities must be strictly positive:

```text
Q > 0
```

4. An inventory adjustment count may be zero:

```text
C(P, L) >= 0
```

5. Stock changes occur only when an operation is successfully validated.
6. Draft, Picked, Packed, and Canceled operations do not change stock.
7. Completed operations must not be applied more than once.
8. Every stock change must have a corresponding ledger entry.
9. Product total stock must equal the sum of its location balances:

```text
T(P) = sum of S(P, L) for every location L
```

## 6. Receipts

A receipt represents incoming stock.

### Preconditions

A receipt may be validated only when:

- The receipt exists.
- The receipt is in an allowed pre-completion state.
- The receipt contains at least one line.
- Every line references an existing product.
- Every line has a valid destination location.
- Every line quantity satisfies `Q > 0`.
- Supplier information is present when required by the interface.
- The receipt is not already Done or Canceled.

### Allowed States

```text
Draft -> Done
Draft -> Canceled
```

`Done` and `Canceled` are terminal states. `Done` means the receipt has been validated.

### Stock Effect

For every receipt line:

```text
S_after(P, L) = S_before(P, L) + Q
```

All unrelated balances remain unchanged.

### Location Effect

- Stock increases at the receipt destination location.
- No other location changes.
- A receipt does not move stock between locations.

### Ledger Effect

For each receipt line, create one positive ledger movement:

```text
Ledger quantity = +Q
Ledger location = destination location
Ledger operation type = Receipt
```

The entry must include product, quantity, location, operation reference, user, and timestamp.

### Invalid Cases

A receipt must not be validated when it has no lines, references an unknown product or location, contains a zero or negative quantity, is already Done, is Canceled, or has any invalid line.

### Atomicity

The receipt is atomic across all lines. If any line is invalid:

```text
No stock changes occur.
No receipt ledger entries are created.
```

### Repeated Validation

Validating a Done receipt again must not change stock or create duplicate ledger entries.

## 7. Deliveries

A delivery represents stock leaving a location.

### Preconditions

A delivery may be validated only when:

- The delivery exists and contains at least one line.
- Every line references an existing product and source location.
- Every line quantity satisfies `Q > 0`.
- The delivery has passed picking and packing.
- The delivery is not already Done or Canceled.
- For every line:

```text
S_before(P, L) >= Q
```

### Allowed States

```text
Draft -> Picked -> Packed -> Done
Draft -> Canceled
Picked -> Canceled
Packed -> Canceled
```

`Done` and `Canceled` are terminal states. Picked and Packed do not change stock.

### Stock Effect

For every delivery line:

```text
S_after(P, L) = S_before(P, L) - Q
```

The result must satisfy:

```text
S_after(P, L) >= 0
```

### Location Effect

- Stock decreases at the delivery source location.
- No destination stock is created by a delivery.
- Picking and packing do not change stock.

### Ledger Effect

For each delivery line:

```text
Ledger quantity = -Q
Ledger location = source location
Ledger operation type = Delivery
```

### Invalid Cases

A delivery must not be validated when it has no lines, references an unknown product or location, contains a zero or negative quantity, lacks required picking or packing, lacks sufficient stock, is Done, or is Canceled.

### Atomicity

The delivery is atomic across all lines. If one line lacks sufficient stock, no line changes stock and no delivery ledger entries are created.

### Repeated Validation

Validating a Done delivery again must not deduct stock or create duplicate ledger entries.

## 8. Internal Transfers

An internal transfer moves stock between two locations.

### Preconditions

A transfer may be validated only when:

- The transfer contains at least one line.
- Every product and location exists.
- Source and destination locations are different.
- Every quantity satisfies `Q > 0`.
- For every line:

```text
S_before(P, source) >= Q
```

- The transfer is not already Done or Canceled.

### Allowed States

```text
Draft -> Done
Draft -> Canceled
```

`Done` and `Canceled` are terminal states.

### Stock Effect

For every transfer line:

```text
S_after(P, source) = S_before(P, source) - Q
S_after(P, destination) = S_before(P, destination) + Q
```

Total company stock is unchanged:

```text
T_after(P) = T_before(P)
```

### Location Effect

- Source stock decreases by `Q`.
- Destination stock increases by `Q`.
- No other location changes.

### Ledger Effect

Each transfer line produces two movements:

```text
Ledger movement 1 = -Q at the source location
Ledger movement 2 = +Q at the destination location
```

Both entries reference the same transfer operation.

### Invalid Cases

A transfer must not be validated when it has no lines, references an unknown product or location, uses identical source and destination locations, contains a zero or negative quantity, lacks source stock, is Done, or is Canceled.

### Atomicity

The transfer is atomic across all lines and both locations. If any line fails, no source stock is reduced, no destination stock is increased, and no ledger entries are created.

### Repeated Validation

Validating a Done transfer again must not move stock or create duplicate ledger entries.

## 9. Inventory Adjustments

An adjustment reconciles recorded stock with a physical count.

### Preconditions

An adjustment may be validated only when:

- The product and location exist.
- A physical count is provided.
- The physical count satisfies:

```text
C(P, L) >= 0
```

- An adjustment reason is provided.
- The adjustment is not already Done or Canceled.

### Allowed States

```text
Draft -> Done
Draft -> Canceled
```

`Done` and `Canceled` are terminal states.

### Stock Effect

Let `R(P, L)` be recorded stock before adjustment and `C(P, L)` be the physical count.

```text
S_after(P, L) = C(P, L)
```

The difference is:

```text
D(P, L) = C(P, L) - R(P, L)
```

### Location Effect

- Only the selected product and location change.
- No other location changes.
- An adjustment does not transfer stock between locations.

### Ledger Effect

Create one adjustment ledger entry containing the signed difference:

```text
Ledger quantity = D(P, L)
Ledger operation type = Adjustment
```

The entry must also include the old quantity, new quantity, reason, product, location, user, timestamp, and operation reference.

### Invalid Cases

An adjustment must not be validated when the product or location is unknown, the physical count is negative, the reason is missing, or the adjustment is Done or Canceled.

### Atomicity

An adjustment is atomic. If multiple adjustment lines are supported, all lines must succeed or none may change stock.

### Repeated Validation

Validating a Done adjustment again must not apply the difference again or create a duplicate ledger entry.

## 10. Stock Ledger

Every stock-changing ledger entry must include:

- Product
- Quantity or signed difference
- Location
- Operation type
- Operation reference
- User
- Timestamp

Ledger sign rules:

- Receipt: positive quantity
- Delivery: negative quantity
- Transfer source: negative quantity
- Transfer destination: positive quantity
- Adjustment: signed difference

For any product and location:

```text
Current stock = opening stock
  + receipt movements
  - delivery movements
  - transfer-out movements
  + transfer-in movements
  + adjustment differences
```

The source documents require historical movement tracking but do not explicitly define ledger editing or deletion.

Recommended rule: completed ledger entries must not be edited or deleted. Corrections must use a new adjustment or compensating operation.

## 11. Operation Statuses

The MVP uses:

- `Draft`
- `Done`
- `Canceled`

Deliveries additionally use:

- `Picked`
- `Packed`

Status stock effects:

| Status | May change stock? |
|---|---:|
| Draft | No |
| Picked | No |
| Packed | No |
| Done | Yes, exactly once |
| Canceled | No |

`Done` and `Canceled` are terminal. A terminal operation cannot be validated again or changed to another status.

The `Ready` status is optional presentation behavior from the P2 scope and is not required for the MVP domain.

## 12. Low-Stock and Out-of-Stock Logic

Let `S(P)` be total current stock and `R(P)` be the product reorder threshold.

Out of stock:

```text
S(P) = 0
```

Low stock:

```text
S(P) > 0 AND S(P) <= R(P)
```

Normal stock:

```text
S(P) > R(P)
```

The reorder threshold must satisfy:

```text
R(P) >= 0
```

If `R(P) = 0`, positive stock is not low stock. Zero stock remains out of stock.

Recommended MVP rule: the threshold belongs to the product and is compared against total product stock, not individual location stock.

## 13. Reordering Threshold

1. Every product stores a reorder threshold.
2. The threshold uses the product's unit of measure.
3. The threshold only controls low-stock classification.
4. The threshold does not change stock.
5. The threshold does not create a ledger entry.
6. The threshold does not create a purchase order.
7. Automated reorder purchasing is outside the MVP.

## 14. Search and Filter Behavior

### Product Search

Products may be searched by name or SKU.

The source documents do not define case sensitivity, partial matching, ranking, or empty-input behavior. These are presentation decisions and do not change domain stock behavior.

### Operation Filters

The MVP supports filters for:

- Document type
- Status
- Location

Category filtering is P1. Warehouse filtering is not useful while the MVP contains one warehouse.

Recommended MVP rule for combined filters:

```text
An operation must satisfy every selected filter.
```

An empty filter does not restrict results. Filters affect display only and never change stock or ledger data.

## 15. Validation

Validation means applying an operation's stock effect and changing its state to `Done`.

Before validation:

1. The operation must be in an allowed pre-completion state.
2. Required fields must be present.
3. Referenced products and locations must exist.
4. Quantities must satisfy the operation-specific rules.
5. Stock availability rules must pass.
6. Every line must pass validation before any line changes stock.
7. The operation must not already be Done or Canceled.

On successful validation:

1. Calculate every stock change.
2. Confirm all changes are valid.
3. Apply all stock changes.
4. Create all ledger entries.
5. Mark the operation as Done.

If any step fails:

```text
No stock changes are applied.
No partial ledger entries are created.
The operation remains in its previous non-terminal state.
```

## 16. Idempotency

Validation is idempotent:

```text
Validate(Validate(O)) = Validate(O)
```

For a completed operation:

- Stock does not change again.
- Ledger entries are not duplicated.
- The operation remains Done.

For a canceled operation:

- Stock does not change.
- Ledger entries are not created.
- The operation remains Canceled.

Each operation must have a unique identity so repeated validation attempts can be recognized as the same operation.

## 17. Atomic Multi-Line Operations

For an operation with lines `L1` through `Ln`, either all valid line effects are applied or none are applied:

```text
Apply(L1) AND Apply(L2) AND ... AND Apply(Ln)
```

or:

```text
No stock changes
No ledger entries
```

Requirements:

- Validate every line before changing stock.
- Validate all source balances before deliveries or transfers.
- Apply all stock changes as one logical operation.
- Create ledger entries only if the complete operation succeeds.
- Mark the operation Done only after all stock and ledger effects succeed.

Example: if a delivery contains 10 units of Product A and 5 units of Product B, but Product B has insufficient stock, neither product changes stock and no delivery ledger entries are created.

## 18. Unresolved Domain Decisions

The following behaviors are not fully specified by the source documents:

1. Whether general user sign-up is required in the MVP.
2. Which location receives initial product stock.
3. Whether initial stock creates an opening ledger entry.
4. Whether a zero-difference adjustment creates a ledger entry.
5. Whether partial receipts or deliveries are supported.
6. Whether completed operations can be reversed.
7. Whether ledger entries are formally immutable.
8. Whether combined filters use AND or OR behavior.
9. Whether low-stock thresholds apply to total product stock or individual locations.
10. Whether `Ready` is required or only a visual enhancement.
11. Whether category and warehouse filters must be present in the MVP.
12. Whether supplier is free text or a managed entity.

Unless the product owner decides otherwise, the recommended MVP interpretations in this document apply.
