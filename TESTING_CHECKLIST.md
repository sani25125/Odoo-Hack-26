# StockSense Testing Checklist

## Test Scope

This checklist is based on FINAL_SCOPE.md and DOMAIN_RULES.md. P0 correctness tests must pass before P1 or P2 features are considered.

Every test should record:

- Preconditions
- Request or user action
- Expected response or screen result
- Expected database effect
- Expected stock balances
- Expected ledger entries

## Authentication

- [ ] Demo user can log in with valid credentials.
- [ ] Invalid credentials return a safe authentication error.
- [ ] Missing credentials are rejected.
- [ ] Authenticated user is redirected to the dashboard.
- [ ] Session persists across page refresh.
- [ ] Logout clears the authenticated session.
- [ ] Protected endpoints reject unauthenticated requests.
- [ ] Password reset request does not reveal whether an email exists.
- [ ] Mock OTP reset accepts a valid unexpired token.
- [ ] Expired, consumed, or invalid OTP is rejected.

## Product Creation and Update

- [ ] Product can be created with name, SKU, category, unit of measure, and reorder threshold.
- [ ] Missing required product fields are rejected.
- [ ] Negative reorder threshold is rejected.
- [ ] Product can be updated.
- [ ] Product category can be selected.
- [ ] Product can be deactivated if supported.
- [ ] Product deletion is not available.
- [ ] Optional initial stock requires a location.
- [ ] Initial stock creates the approved opening balance and ledger behavior.
- [ ] Zero initial stock follows the documented contract.

## Duplicate SKU

- [ ] Exact duplicate SKU is rejected.
- [ ] Case-only duplicate SKU is rejected.
- [ ] Duplicate SKU update is rejected.
- [ ] Leading/trailing whitespace cannot bypass uniqueness.
- [ ] Failed duplicate creation does not create a partial product or stock record.

## Categories and Locations

- [ ] Seeded categories can be loaded.
- [ ] Seeded warehouse locations can be loaded.
- [ ] Inactive products cannot be selected for new operations.
- [ ] Inactive locations cannot be selected for new operations.
- [ ] Unknown category IDs are rejected.
- [ ] Unknown location IDs are rejected.
- [ ] Location history remains readable after deactivation.

## Receipt

- [ ] Draft receipt can be created.
- [ ] Receipt requires at least one line.
- [ ] Supplier value is validated.
- [ ] Receipt line requires product ID, destination location ID, and quantity.
- [ ] Receipt quantity must be greater than zero.
- [ ] Duplicate product/location lines are rejected.
- [ ] Draft receipt does not change stock.
- [ ] Draft receipt does not create ledger entries.
- [ ] Validated receipt increases destination stock.
- [ ] One positive ledger entry is created per receipt line.
- [ ] Receipt records authenticated user and timestamps.
- [ ] Multi-line receipt succeeds completely when every line is valid.
- [ ] Multi-line receipt makes no changes when one line is invalid.
- [ ] Canceled receipt does not change stock.

## Delivery

- [ ] Draft delivery can be created.
- [ ] Delivery requires at least one line.
- [ ] Delivery line requires product ID, source location ID, and quantity.
- [ ] Delivery quantity must be greater than zero.
- [ ] Picking changes status to PICKED only.
- [ ] Packing changes status to PACKED only.
- [ ] Picking does not change stock.
- [ ] Packing does not change stock.
- [ ] Delivery can be validated only from PACKED.
- [ ] Validated delivery decreases source stock.
- [ ] One negative ledger entry is created per delivery line.
- [ ] Delivery beyond available stock is rejected.
- [ ] Failed delivery leaves every line and balance unchanged.
- [ ] Draft, Picked, Packed, and Canceled delivery states create no ledger entries.
- [ ] Picked or Packed delivery cannot be edited.
- [ ] Canceled delivery cannot be validated.

## Internal Transfer

- [ ] Draft transfer can be created.
- [ ] Transfer requires at least one line.
- [ ] Transfer line requires product ID, source location ID, destination location ID, and quantity.
- [ ] Transfer quantity must be greater than zero.
- [ ] Same source and destination location is rejected.
- [ ] Transfer beyond source stock is rejected.
- [ ] Validated transfer decreases source stock.
- [ ] Validated transfer increases destination stock.
- [ ] Total product stock is unchanged after transfer.
- [ ] One negative TRANSFER_OUT ledger entry is created per line.
- [ ] One positive TRANSFER_IN ledger entry is created per line.
- [ ] Failed multi-line transfer changes neither source nor destination.
- [ ] Canceled transfer does not change stock.

## Inventory Adjustment

- [ ] Draft adjustment can be created with a reason.
- [ ] Adjustment requires at least one line.
- [ ] Physical count must be greater than or equal to zero.
- [ ] Adjustment to zero is accepted.
- [ ] Negative physical count is rejected.
- [ ] Recorded quantity is shown before validation.
- [ ] Validated adjustment sets stock to the physical count.
- [ ] Difference equals physical count minus recorded quantity.
- [ ] Old quantity, new quantity, difference, reason, user, and timestamp are stored.
- [ ] Negative adjustment difference is supported when count is lower.
- [ ] Positive adjustment difference is supported when count is higher.
- [ ] Canceled adjustment does not change stock.
- [ ] Multi-line adjustment is atomic if supported.

## Stock Ledger

- [ ] Every successful receipt creates the expected positive ledger entry.
- [ ] Every successful delivery creates the expected negative ledger entry.
- [ ] Every successful transfer creates both source and destination entries.
- [ ] Every successful adjustment creates the expected signed entry.
- [ ] Every ledger entry contains operation ID.
- [ ] Every ledger entry contains operation line ID.
- [ ] Every ledger entry contains product ID and location ID.
- [ ] Every ledger entry contains operation type and entry kind.
- [ ] Every ledger entry contains quantity before and quantity after.
- [ ] Quantity after equals quantity before plus quantity delta.
- [ ] Every ledger entry contains authenticated user and timestamp.
- [ ] Draft and Canceled operations have no stock ledger movements.
- [ ] Completed ledger entries cannot be edited or deleted.
- [ ] Ledger history can be paginated.
- [ ] Ledger history can be filtered by product, location, operation type, and time.

## Draft Operations

- [ ] Draft receipt has no stock effect.
- [ ] Draft delivery has no stock effect.
- [ ] Draft transfer has no stock effect.
- [ ] Draft adjustment has no stock effect.
- [ ] Draft operations can be edited only where approved.
- [ ] Draft operation lines can be validated before completion.
- [ ] Empty or invalid Draft operations cannot be validated.

## Canceled Operations

- [ ] Draft receipt can be canceled.
- [ ] Draft transfer can be canceled.
- [ ] Draft adjustment can be canceled.
- [ ] Delivery can be canceled from DRAFT, PICKED, or PACKED.
- [ ] Canceled operation cannot be edited.
- [ ] Canceled operation cannot be validated.
- [ ] Canceled operation does not change stock.
- [ ] Canceled operation does not create ledger entries.

## Duplicate Validation and Idempotency

- [ ] Repeating receipt validation does not increase stock twice.
- [ ] Repeating delivery validation does not decrease stock twice.
- [ ] Repeating transfer validation does not move stock twice.
- [ ] Repeating adjustment validation does not apply the difference twice.
- [ ] Repeated validation does not duplicate ledger entries.
- [ ] Concurrent validation requests produce only one stock effect.
- [ ] Already-DONE validation returns the documented idempotent result.
- [ ] CANCELED validation returns INVALID_STATUS and has no effect.

## Invalid Quantities

- [ ] Zero receipt quantity is rejected.
- [ ] Negative receipt quantity is rejected.
- [ ] Zero delivery quantity is rejected.
- [ ] Negative delivery quantity is rejected.
- [ ] Zero transfer quantity is rejected.
- [ ] Negative transfer quantity is rejected.
- [ ] Zero opening movement quantity is rejected when opening stock is provided.
- [ ] Negative opening movement quantity is rejected.
- [ ] Zero adjustment physical count is accepted.
- [ ] Negative adjustment physical count is rejected.
- [ ] More than three fractional digits are rejected or normalized according to the API contract.
- [ ] Non-numeric quantity is rejected.

## Insufficient Stock and Atomicity

- [ ] Delivery with insufficient stock returns INSUFFICIENT_STOCK.
- [ ] Transfer with insufficient source stock returns INSUFFICIENT_STOCK.
- [ ] Multi-line delivery with one insufficient line changes no line.
- [ ] Multi-line transfer with one insufficient line changes neither location for any line.
- [ ] Multi-line adjustment with one invalid line changes no line if multi-line adjustments are supported.
- [ ] Stock balances are locked before availability is checked.
- [ ] Concurrent deliveries cannot produce negative stock.
- [ ] Failed transaction rolls back stock, ledger, status, and adjustment before/after values.

## Same Source and Destination

- [ ] Transfer with identical source and destination IDs is rejected.
- [ ] Rejection creates no stock balance changes.
- [ ] Rejection creates no ledger entries.

## Dashboard

- [ ] Dashboard requires authentication.
- [ ] Total distinct products matches the documented definition.
- [ ] Total units equals the sum of location balances.
- [ ] Out-of-stock means total quantity equals zero.
- [ ] Low-stock means quantity is above zero and at or below reorder threshold.
- [ ] Pending receipt count is correct.
- [ ] Pending delivery count is correct.
- [ ] Pending transfer count is correct.
- [ ] Recent activity reflects successful ledger entries.
- [ ] Dashboard does not count Draft or Canceled operations as completed.
- [ ] Dashboard refreshes after a successful mutation.
- [ ] Dashboard does not derive current stock by scanning the entire ledger.

## Search and Filter

- [ ] Product search matches name.
- [ ] Product search matches SKU.
- [ ] Product search is case-insensitive.
- [ ] Product search supports partial matching.
- [ ] Empty search returns the normal product list.
- [ ] Operation filter by type works.
- [ ] Operation filter by status works.
- [ ] Operation filter by location works.
- [ ] Category filter works when P1 is enabled.
- [ ] Combined filters use AND semantics.
- [ ] Invalid UUID filters are rejected.
- [ ] Pagination does not duplicate or skip records.
- [ ] Ledger pagination uses cursor/keyset behavior.

## Error Handling

- [ ] Invalid JSON returns a validation error.
- [ ] Missing required fields identify the relevant field.
- [ ] Malformed UUID returns VALIDATION_ERROR.
- [ ] Unknown resource returns NOT_FOUND.
- [ ] Duplicate SKU returns CONFLICT.
- [ ] Invalid status transition returns INVALID_STATUS.
- [ ] Insufficient stock returns INSUFFICIENT_STOCK.
- [ ] Missing session returns UNAUTHORIZED.
- [ ] Inactive product/location returns CONFLICT or VALIDATION_ERROR as documented.
- [ ] Database constraint failures are translated into safe API errors.
- [ ] Unexpected errors return INTERNAL_ERROR without stack traces or SQL details.

## API and Frontend Integration

- [ ] Frontend uses the /api/v1 base path.
- [ ] Frontend uses camelCase field names.
- [ ] Frontend treats quantities as decimal strings.
- [ ] Frontend uses uppercase operation statuses.
- [ ] Frontend uses operationId for operation navigation.
- [ ] Frontend uses operationLineId for source-line references.
- [ ] Frontend uses ledgerEntryId for ledger navigation.
- [ ] Frontend does not send createdBy or completedBy as authoritative values.
- [ ] Frontend displays server-side validation errors.
- [ ] Frontend handles 401 by returning to login.
- [ ] Frontend handles 409 without losing valid form input.
- [ ] Repeated submit after a timeout does not duplicate stock.

## Responsive UI

- [ ] Login works at mobile width.
- [ ] Dashboard KPIs do not overlap at mobile width.
- [ ] Product forms remain usable at mobile width.
- [ ] Receipt lines remain readable at mobile width.
- [ ] Delivery Picked/Packed/Done controls remain accessible at mobile width.
- [ ] Transfer source and destination controls remain distinguishable at mobile width.
- [ ] Adjustment count and reason fields remain usable at mobile width.
- [ ] Ledger table can scroll or reflow without hiding critical values.
- [ ] Validation and error messages do not overlap controls.
- [ ] Desktop layout remains usable at the target judging resolution.

## Final Demo Regression

- [ ] Log in.
- [ ] Create or open a product.
- [ ] Receive 100 units into Main Store.
- [ ] Transfer 30 units to Production Rack.
- [ ] Pick and pack a delivery.
- [ ] Deliver 20 units from Production Rack.
- [ ] Adjust remaining stock after damaged items are found.
- [ ] Verify final quantities by location.
- [ ] Open the ledger and explain every stock change.
- [ ] Refresh the page and confirm data persists.
- [ ] Repeat a validation request and confirm no duplicate stock effect.

## Completion Gate

P0 is complete only when the final demo regression passes and no test shows partial stock updates, negative stock, duplicate validation effects, or missing ledger history.

P1 and P2 work must not begin while a P0 integrity test is failing.
