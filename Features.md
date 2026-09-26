# StockSense MVP Features

## Scope

This feature set is the implementation boundary for a one-person team with approximately four hours of development time.

The MVP must demonstrate one complete inventory lifecycle:

`Create product -> receive stock -> transfer stock -> deliver stock -> adjust stock -> inspect ledger`

Prioritize correct stock behavior and a reliable demo over feature quantity.

## P0 - Absolutely Required

P0 features must be completed before optional work begins.

### Minimal Authentication

- Login with a demo user.
- Persist the logged-in session.
- Logout.
- Redirect authenticated users to the dashboard.
- A password-reset screen may be represented by a mocked OTP flow if time permits.

### Application Shell and Dashboard

- Provide the main navigation and authenticated application layout.
- Show total distinct products with stock records.
- Show total units across all locations.
- Show low-stock and out-of-stock products.
- Show pending receipt, delivery, and transfer counts.
- Show recent inventory activity.

Dashboard interpretation:

- Total products means distinct products with stock records.
- Total units means the sum of quantities across all locations.

### Product and Location Setup

- Create and update products.
- Store product name, unique SKU, category, unit of measure, and reorder threshold.
- Support optional initial stock.
- Support a single warehouse with two or three locations.
- Search products by name or SKU.
- Reject duplicate SKUs.
- Do not implement product deletion.

Suggested demo locations:

- Main Store
- Production Rack
- Dispatch

### Inventory Operation Engine and Ledger

- Support receipts, deliveries, transfers, and adjustments.
- Track stock by product and location.
- Track operation status.
- Apply stock changes only when an operation is validated.
- Do not change stock for Draft or Canceled operations.
- Prevent an operation from being applied more than once.
- Apply all lines in a multi-line operation together or not at all.
- Reject zero and negative movement quantities.
- Record product, quantity, location, operation type, user, and timestamp in the ledger.

### Receipt Workflow

- Create a receipt.
- Select or enter a supplier as a simple text value.
- Add one or more products and quantities.
- Save the receipt as Draft.
- Validate the receipt.
- Increase stock only on validation.
- Create a ledger entry for each stock increase.

### Delivery Workflow

- Create a delivery order.
- Select products, quantities, and source location.
- Support Picked and Packed statuses.
- Validate the delivery.
- Decrease stock only when the delivery is validated.
- Prevent delivery beyond available stock.
- Create a ledger entry for each stock decrease.

Picked and Packed statuses do not change stock. Only the final validation changes stock.

### Internal Transfer Workflow

- Select a source location and destination location.
- Select products and quantities.
- Prevent the source and destination from being identical.
- Prevent transfers beyond source stock.
- Validate the transfer.
- Decrease stock at the source.
- Increase stock at the destination.
- Keep total company stock unchanged.
- Record the movement in the ledger.

### Inventory Adjustment Workflow

- Select a product and location.
- Display the recorded quantity.
- Enter the physical counted quantity.
- Enter an adjustment reason.
- Validate the adjustment.
- Set recorded stock to the counted quantity.
- Record the old quantity, new quantity, difference, reason, user, and timestamp.
- Allow zero as a valid counted quantity.

### Move History

- Provide a simple stock ledger or move-history table.
- Show date and time, product, operation type, quantity change, location, user, and operation reference.
- Allow users to inspect the reason for every stock change.

## P1 - Important

Implement P1 features only after every P0 workflow works end to end.

### Basic Operation Filters

- Filter operations by type.
- Filter operations by status.
- Filter operations by location.

Category and warehouse filters are lower priority for the single-warehouse MVP.

### Low-Stock and Out-of-Stock Indicators

- Out of stock means quantity equals zero.
- Low stock means quantity is above zero and at or below the reorder threshold.
- Show indicators on the dashboard and product list.

### Stock by Location View

- Show each product's quantity per location.
- Show the product's total quantity across locations.
- Ensure total product stock equals the sum of its location balances.

### Seeded Demo Data

Seed the application with:

- Two or three products.
- Multiple locations.
- One low-stock product.
- One pending receipt.
- One pending delivery.
- One completed movement.

### Mocked OTP Password Reset

- Provide a reset-password screen.
- Accept a demonstrable mock OTP.
- Do not integrate email or SMS during the MVP.

## P2 - Differentiators

P2 features are optional and should only be attempted after P0 and selected P1 features are stable.

### Stock-Change Drill-Down

- Selecting a stock balance shows the ledger entries that produced it.
- Prefer this feature over other visual enhancements because it reinforces traceability.

### Guided Operation Statuses

- Display a clear Draft -> Ready -> Done -> Canceled progression.
- Use the existing operation screens and status controls.
- Do not create a separate workflow-management module.

### Exception-Focused Dashboard

Highlight:

- Out-of-stock products.
- Low-stock products.
- Deliveries blocked by insufficient stock.
- Pending operations.

This should extend the existing dashboard rather than create a separate page.

### Compact Stock-Flow Timeline

- Show a simple chronological timeline for a selected product.
- Include receipts, transfers, deliveries, and adjustments.
- Use a table or compact timeline; do not build a complex chart.


## Recommended Build Order

1. Inventory operation engine and ledger.
2. Product and location setup.
3. Receipt workflow.
4. Delivery workflow.
5. Internal transfer workflow.
6. Inventory adjustment workflow.
7. Dashboard and low-stock indicators.
8. Move history.
9. Minimal authentication.
10. Seeded demo data.
11. Basic operation filters.
12. Stock-change drill-down, only if time remains.

## Four-Hour Demo Acceptance Path

The MVP is ready for judging when this scenario works reliably:

1. Log in.
2. Create or open a product.
3. Receive 100 units into Main Store.
4. Transfer 30 units to Production Rack.
5. Deliver 20 units from Production Rack.
6. Adjust the remaining stock after discovering damaged units.
7. View final quantities by location.
8. Open the ledger and explain every stock change.

Once this path works, stop adding features and use the remaining time for validation, bug fixes, and demo preparation.
