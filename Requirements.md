MUST HAVE: Explicit or Essential
Authentication
- User can sign up and log in.
- User is redirected to the inventory dashboard after login.
- User can initiate an OTP-based password reset.
- For the hackathon, OTP delivery may be mocked or simulated if the flow is demonstrable.
Dashboard
- Show total products or stock summary, with the exact interpretation documented.
- Show low-stock and out-of-stock items.
- Show pending receipts.
- Show pending deliveries.
- Show scheduled internal transfers.
- Filter operations by:
  - Document type
  - Status
  - Warehouse or location
  - Product category
Products
- Create and update products.
- Store:
  - Name
  - SKU or code
  - Category
  - Unit of measure
  - Optional initial stock
- Show stock availability by location.
- Support product categories.
- Support a reorder or low-stock threshold.
Receipts
- Create a receipt.
- Select or record a supplier.
- Add one or more products and quantities.
- Validate the receipt.
- Increase stock only when validated.
- Record the movement in the ledger.
Delivery Orders
- Create a delivery order.
- Select products and quantities.
- Support picking.
- Support packing.
- Validate the delivery.
- Decrease stock only when validated.
- Prevent delivery beyond available stock unless the product is explicitly allowed to go negative.
Internal Transfers
- Select source and destination locations.
- Add products and quantities.
- Decrease stock at the source.
- Increase stock at the destination.
- Keep total company stock unchanged.
- Record the movement in the ledger.
Inventory Adjustments
- Select product and location.
- Enter physical counted quantity.
- Set recorded stock to the counted quantity.
- Log the difference and reason.
- Record the adjustment in the ledger.
History and Integrity
- Provide move history or stock ledger.
- Store product, quantity, location, operation type, user, and timestamp.
- Draft and canceled operations must not change stock.
- Validation must be idempotent and must not apply twice.
- Multi-line operations must apply atomically.
- Quantities must be positive.
- SKU must be unique.