# StockSense Architecture

## 1. Architecture Goals

StockSense uses a small modular monolith:

- React and Vite frontend
- Node.js and Express REST backend
- PostgreSQL database
- Server-authoritative inventory calculations
- One PostgreSQL transaction for each stock-changing validation
- No Firebase, Supabase, Redis, queues, or unnecessary external services

This is appropriate for a solo developer because it is small, easy to explain, quick to implement, and strong enough to protect inventory consistency.

The central rule is:

> The backend owns stock calculations. The frontend never directly changes inventory quantities.

## 2. High-Level Architecture

    React + Vite UI
            |
            | REST requests
            v
    Express REST API
            |
            +-- Authentication
            +-- Product service
            +-- Operation service
            +-- Dashboard service
            +-- Ledger service
            |
            v
    PostgreSQL

Use a modular monolith rather than microservices. Microservices would add deployment and consistency complexity without helping the hackathon implementation.

## 3. Frontend Architecture

Use React with Vite and feature-oriented modules:

- Authentication
- Dashboard
- Products
- Receipts
- Deliveries
- Transfers
- Adjustments
- Ledger
- Shared UI and form components

The frontend is responsible for rendering, forms, immediate field validation, REST calls, error display, status display, and refreshing affected data.

The frontend must not calculate authoritative stock effects. Use React state for forms, a small authentication context, and native fetch or one small API client. Avoid a large client state-management library for the MVP.

## 4. Backend Architecture

Use Express as a modular monolith with these layers:

1. Routes
2. Request validation
3. Application services
4. Domain validation
5. Repository/data access
6. PostgreSQL

Suggested modules:

- auth
- products
- locations
- operations
- stock
- ledger
- dashboard

Routes should authenticate, parse input, call a service, and translate the result into an HTTP response. Routes must not contain stock arithmetic or transaction logic.

## 5. Database Architecture

PostgreSQL is the source of truth. This document defines logical data boundaries, not a detailed schema.

Core data areas:

- Users and sessions
- Products and categories
- Warehouse and locations
- Inventory operations
- Operation lines
- Stock balances
- Stock ledger entries

The database must support unique SKUs, valid operation states, non-negative stock, product/location identity, operation identity, ledger references, and transactional stock updates.

Maintain a current stock balance per product and location for fast reads. Keep the ledger as the historical explanation of changes:

    Stock balance = current quantity
    Ledger = historical explanation of changes

## 6. Service and Business-Logic Architecture

### Product Service

- Create and update products
- Enforce required fields and SKU uniqueness
- Validate reorder thresholds
- Manage optional initial stock

### Operation Service

- Create Draft operations
- Add and validate operation lines
- Change preparation statuses
- Validate and complete operations
- Enforce idempotency
- Coordinate stock and ledger updates

### Stock Service

- Read balances
- Calculate total product stock
- Validate available stock
- Apply receipts, deliveries, transfers, and adjustments

Stock mutations must only run inside the operation transaction.

### Ledger Service

- Create movement entries
- Record operation references, user, and timestamp
- Retrieve movement history

### Dashboard Service

- Calculate product totals and total units
- Identify low-stock and out-of-stock products
- Count pending operations
- Return recent activity

## 7. Repository and Data-Access Architecture

Repositories contain database access only:

- ProductRepository
- LocationRepository
- OperationRepository
- StockRepository
- LedgerRepository
- UserRepository

Repositories must not decide whether an operation is valid. Domain and application services make that decision.

The operation service obtains one PostgreSQL transaction and passes its transaction context to every repository involved in the mutation.

## 8. Authentication Architecture

The MVP requires demo login, session persistence, logout, and dashboard redirect.

Use an HTTP-only signed authentication cookie. It should be HTTP-only, Secure in production, SameSite=Lax, short-lived or renewable, and cleared on logout. Do not store authentication tokens in localStorage.

Mocked OTP reset is P1. Real email or SMS delivery is out of scope. General sign-up appears in Requirements.md but is outside the finalized MVP unless explicitly reinstated.

## 9. Validation Architecture

Validation occurs at two levels.

### Request Validation

Validate required fields, types, numeric formats, string lengths, empty values, and basic enum values.

### Domain Validation

Validate product and location existence, SKU uniqueness, operation state, positive movement quantities, non-negative adjustment counts, sufficient stock, different transfer locations, required picking and packing, and idempotent completion.

The backend must repeat important validation even when the frontend performs the same checks.

## 10. Error-Handling Architecture

Use consistent error categories:

- 400: malformed or invalid input
- 401: missing or invalid authentication
- 403: authenticated but not permitted
- 404: product, location, or operation not found
- 409: duplicate SKU, invalid status, insufficient stock, or already-completed operation
- 500: unexpected server failure

Responses should contain a stable error code, human-readable message, and optional field details. Do not expose SQL, stack traces, secrets, or internal database structure.

## 11. Inventory Transaction Architecture

Every stock-changing operation must execute in one PostgreSQL transaction.

Completion sequence:

1. Start a transaction.
2. Lock the operation row.
3. Read the current status.
4. If status is Done, return an idempotent success without changes.
5. If status is Canceled, reject completion.
6. Validate every operation line.
7. Lock all affected stock rows in deterministic order.
8. Re-check stock using the locked values.
9. Apply every stock balance change.
10. Insert every ledger entry.
11. Mark the operation Done.
12. Commit.

If any step fails, roll back stock changes, ledger entries, and status changes.

Row locks prevent two concurrent deliveries from consuming the same stock. Stable lock ordering reduces transfer deadlocks.

## 12. Stock Ledger Architecture

The ledger is append-oriented and linked to the completed operation.

Receipt:

    stock_after = stock_before + received_quantity
    ledger_quantity = +received_quantity

Delivery:

    stock_after = stock_before - delivered_quantity
    ledger_quantity = -delivered_quantity

Transfer:

    source_after = source_before - quantity
    destination_after = destination_before + quantity
    total_company_stock = unchanged

Create one negative source movement and one positive destination movement.

Adjustment:

    stock_after = physical_counted_quantity
    difference = physical_counted_quantity - recorded_quantity
    ledger_quantity = difference

Ledger entries are created only after validation passes, reference their operation, and must not be duplicated by retries. Completed entries should be treated as immutable; corrections use a new adjustment or compensating operation.

## 13. Dashboard Architecture

Use a dedicated dashboard read service rather than assembling metrics in the frontend.

Return:

- Distinct products with stock records
- Total units across locations
- Low-stock products
- Out-of-stock products
- Pending receipts
- Pending deliveries
- Pending transfers
- Recent ledger activity

Definitions:

    total_products = distinct products with stock records
    total_units = sum of all location stock balances
    out_of_stock = total_units = 0
    low_stock = total_units > 0 AND total_units <= reorder_threshold

Read directly from PostgreSQL for the MVP. Avoid Redis and precomputed dashboard stores.

## 14. P0 Workflow Data Flows

### Product Creation

The frontend submits a product, request validation runs, the product service checks SKU uniqueness, the repository persists the product, and the backend returns the committed product. Initial stock must include a location.

### Receipt

Create a Draft receipt and lines. On validation, begin a transaction, lock the receipt, validate status and lines, lock balances, increase stock, insert positive ledger entries, mark the receipt Done, and commit.

### Delivery

Create a Draft delivery and lines. Move it through Picked and Packed; these states do not change stock. On final validation, lock the delivery and source balances, re-check availability, decrease stock, insert negative ledger entries, mark the delivery Done, and commit.

### Internal Transfer

Lock the transfer, source balances, and destination balances. Re-check source stock, decrease source stock, increase destination stock, insert both ledger movements, mark the transfer Done, and commit.

### Inventory Adjustment

Lock the adjustment and selected balance. Read recorded quantity, calculate the difference, set stock to the physical count, write the signed ledger entry, mark the adjustment Done, and commit.

### Move History

The frontend requests ledger entries through the ledger service. Results include product, location, operation type, quantity, user, timestamp, and operation reference.

## 15. Search and Filter Architecture

Search products by name or SKU using parameterized backend queries.

Support operation filters for:

- Document type
- Status
- Location
- Category when P1 is implemented

Warehouse filtering is unnecessary while the MVP contains one warehouse.

Recommended combined-filter behavior:

    All selected filters use AND semantics.

Filters affect read results only and never mutate inventory.

## 16. Security Architecture

Required controls:

- HTTP-only authentication cookies
- Password hashing using a vetted library
- Parameterized SQL
- Backend authorization on protected routes
- Input validation
- Environment variables for credentials
- CORS restricted to the frontend origin
- Secure HTTP headers
- Request body limits
- Generic production errors

Inventory-specific controls:

- Never trust frontend stock quantities.
- Never accept a client-provided final stock balance for receipts, deliveries, or transfers.
- Recalculate stock effects on the backend.
- Require the authenticated user for ledger entries.
- Never allow clients to mark operations Done without validation.

## 17. Performance Considerations

- Use a PostgreSQL connection pool.
- Index SKU.
- Index operation status and type.
- Index ledger timestamp and operation reference.
- Index stock balance by product and location.
- Paginate ledger and operation lists.
- Return only fields required by each screen.
- Avoid N+1 queries.
- Refresh affected data after successful mutations.

Avoid premature caching, Redis, background jobs, event streaming, and loading the full ledger into the browser.

## 18. Scalability Considerations

The modular monolith can scale vertically and later horizontally. Keep repositories behind service boundaries, keep stock validation in one domain service, and keep ledger writes inside the same transaction as stock changes.

Do not introduce microservices during the hackathon. Inventory and ledger consistency are easiest to maintain inside one PostgreSQL transaction.

## 19. Local and Offline Resilience

The MVP is online-first:

- PostgreSQL runs locally or in a controlled development environment.
- The backend is the only component that writes inventory.
- The frontend displays a clear error when the API is unavailable.
- Forms retain unsaved input during validation errors.
- Requests must not be automatically replayed without preserving operation identity.

Offline stock mutation is out of scope. Idempotent server-side validation protects against retries after a timeout.

## 20. Project Folder Structure

    stocksense/
      frontend/
        src/
          app/
          components/
          features/
            auth/
            dashboard/
            products/
            receipts/
            deliveries/
            transfers/
            adjustments/
            ledger/
          services/
          hooks/
          styles/
      backend/
        src/
          config/
          middleware/
          routes/
          modules/
            auth/
            products/
            locations/
            operations/
            stock/
            ledger/
            dashboard/
          repositories/
          validation/
          errors/
          database/
          server/
      docs/
        Requirements.md
        Features.md
        FINAL_SCOPE.md
        Domain_Rules.md
        ARCHITECTURE.md

Business logic must not be placed directly in route handlers.

## 21. Major Technical Risks

### Partial Stock Updates

Use one PostgreSQL transaction for stock, ledger, and operation status.

### Duplicate Validation

Lock the operation row, check status inside the transaction, and create ledger entries only once.

### Concurrent Deliveries

Lock stock rows and re-check availability inside the transaction.

### Incorrect Transfers

Apply source and destination changes in the same transaction and verify total stock remains unchanged.

### Dashboard Inconsistency

Calculate dashboard values on the backend from authoritative stock data.

### Ambiguous Initial Stock

Require a location and document whether an opening ledger entry is created.

### Scope Expansion

Complete the receive -> transfer -> deliver -> adjust lifecycle before P1 or P2 work.

## 22. Recommended Implementation Order

1. Configure PostgreSQL and environment variables.
2. Establish backend modules and error format.
3. Create product, location, operation, stock, and ledger persistence.
4. Implement product and location operations.
5. Implement shared validation and transaction handling.
6. Implement receipt validation.
7. Implement delivery validation with Picked and Packed states.
8. Implement transfer validation.
9. Implement adjustment validation.
10. Implement ledger history.
11. Implement authentication and protected routes.
12. Implement dashboard summary.
13. Build React dashboard and product views.
14. Build operation screens.
15. Add basic filters and seeded data.
16. Test the complete lifecycle and repeated validation.
17. Add P1 or P2 features only if P0 is stable.

## 23. Architectural Completion Criteria

The application is complete when it can reliably:

1. Authenticate a demo user.
2. Create or update a product.
3. Receive stock into a location.
4. Transfer stock between locations.
5. Pick, pack, and deliver stock.
6. Adjust stock to a physical count.
7. Display accurate stock by location.
8. Display low-stock and out-of-stock products.
9. Show the complete movement ledger.
10. Reject invalid operations without partial updates.
11. Repeat validation without duplicate stock changes.
12. Complete the full demo lifecycle using dynamic PostgreSQL data.
