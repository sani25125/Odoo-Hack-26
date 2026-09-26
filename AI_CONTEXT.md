# StockSense AI Context

## Project Purpose

StockSense is a centralized inventory management system that replaces manual registers, spreadsheets, and scattered stock tracking with one reliable application.

The core demo lifecycle is:

Create product -> receive stock -> transfer stock -> deliver stock -> adjust stock -> inspect ledger

Inventory correctness is more important than feature quantity or visual polish.

## Final MVP Scope

### P0

- Demo login, session persistence, logout, and dashboard redirect.
- One warehouse with multiple active locations.
- Product creation and update.
- Unique SKU.
- Product category, unit of measure, reorder threshold, and optional initial stock.
- Current stock by product and location.
- Receipt creation, Draft state, validation, and stock increase.
- Delivery creation, Picked and Packed states, validation, and stock decrease.
- Internal transfers.
- Physical stock adjustments.
- Dashboard summaries and low/out-of-stock display.
- Stock movement ledger.
- User and timestamp tracking.
- Draft and Canceled operations do not affect stock.
- Idempotent validation.
- Atomic multi-line operations.
- Positive movement quantities.
- No negative stock.

### P1

- Operation filters.
- Category filtering.
- Product search.
- Stock-by-location summary.
- Seeded demo data.
- Mocked OTP reset.
- Detailed status labels.
- Delivery exception indicators.
- Stock-change drill-down.

### P2

- Product stock-flow timeline.
- Polished exception dashboard.
- Enhanced status visualization.
- Compact visual lifecycle presentation.

### Out of Scope

- General sign-up in the MVP.
- Product, location, or warehouse deletion/administration.
- Supplier or customer CRUD.
- Real email or SMS OTP delivery.
- Negative-stock configuration.
- Partial receipt or delivery completion.
- Barcode scanning.
- Batch or serial tracking.
- Inventory valuation.
- Purchase, sales, or ERP integrations.
- Offline mutation queues.
- Microservices and unnecessary infrastructure.

## Technology Stack

- Frontend: React with Vite.
- Backend: Node.js with Express.
- API: REST under /api/v1.
- Database: PostgreSQL controlled by the application.
- Authentication: HTTP-only session cookie.

Do not replace PostgreSQL with Firebase, Supabase, or another Backend-as-a-Service platform.

## Architecture

Use a modular monolith:

Frontend -> Express REST API -> application/domain services -> repositories -> PostgreSQL

Backend modules:

- auth
- products
- locations
- operations
- stock
- ledger
- dashboard

Routes must remain thin. Stock arithmetic and business rules belong in services, not route handlers.

## PostgreSQL Approach

PostgreSQL is the source of truth.

The database contains:

- users
- password reset tokens
- categories
- warehouses
- locations
- products
- inventory operations
- operation-specific headers and lines
- stock balances
- stock ledger

Current stock is stored in stock_balances for fast reads. The ledger is append-oriented history and audit data.

All product/location stock mutations, ledger inserts, and final operation status updates occur in one PostgreSQL transaction.

Use numeric quantities, not floating-point quantities. Use explicit foreign keys, unique constraints, quantity checks, non-negative stock checks, and indexes described in DATABASE.md.

## Domain Rules

- SKU is unique case-insensitively.
- Products and locations are deactivated rather than deleted.
- The MVP has one warehouse and multiple locations.
- Movement quantities for receipts, deliveries, transfers, and opening stock are greater than zero.
- Adjustment physical counts may be zero.
- Stock balances cannot be negative.
- Draft, Picked, Packed, and Canceled operations do not change stock.
- Done changes stock exactly once.
- Receipt: destination stock increases by quantity.
- Delivery: source stock decreases by quantity.
- Transfer: source decreases, destination increases, and total company stock is unchanged.
- Adjustment: stock becomes the physical count and difference equals count minus recorded stock.
- Every stock change creates ledger history.
- Low stock means total quantity is greater than zero and less than or equal to the product reorder threshold.
- Out of stock means total quantity equals zero.

## Inventory Integrity Rules

Every validation must:

1. Lock the operation row.
2. Check the current operation status.
3. Validate every line.
4. Ensure and lock every affected stock balance row.
5. Re-check availability using locked values.
6. Apply all stock changes.
7. Insert all ledger entries.
8. Mark the operation Done.
9. Commit.

Any failure rolls back all stock, ledger, before/after, and status changes.

Repeated validation of a Done operation is an idempotent no-op. It must not change stock or create duplicate ledger entries.

Concurrent stock operations must lock stock rows in deterministic product/location order.

## API Conventions

- Base path: /api/v1.
- Protected endpoints require the HTTP-only session cookie.
- IDs are UUID strings.
- Timestamps are ISO 8601.
- Quantity fields are decimal strings with at most three fractional digits.
- Canonical field names use camelCase.
- Status values are uppercase: DRAFT, PICKED, PACKED, DONE, CANCELED.
- Operation types are RECEIPT, DELIVERY, TRANSFER, and ADJUSTMENT. OPENING is internal.
- operationId identifies an operation.
- operationLineId identifies its source line.
- ledgerEntryId identifies a ledger movement.
- Filters use AND semantics.
- Ledger and operation history use cursor/keyset pagination.
- Backend derives audit user fields from the authenticated session.

Do not change API paths, field names, status values, quantity format, or response semantics without explicit approval.

## Frontend Conventions

- Use feature-oriented React modules.
- Keep forms and immediate field validation in the frontend.
- Treat the backend as authoritative for stock and status.
- Do not calculate authoritative inventory totals in the browser.
- Use the canonical API representations.
- Display server validation and conflict errors clearly.
- Preserve unsaved form input after ordinary validation failures.
- Use one canonical stock read: GET /stock with productId when needed.
- Keep P1/P2 UI work behind the complete P0 lifecycle.

## Backend Conventions

- Use thin Express routes.
- Use request validation before service calls.
- Repeat all important domain validation on the backend.
- Use services for inventory rules.
- Use repositories for database access only.
- Use one transaction for each final inventory validation.
- Lock operation rows before idempotency checks.
- Lock stock rows before availability checks.
- Never accept client-provided final stock values.
- Derive createdBy, completedBy, canceledBy, and ledger user from the session.
- Return consistent JSON errors.

## Validation Rules

Validate:

- Required fields and types.
- UUID format.
- Decimal quantity format.
- Positive movement quantities.
- Non-negative adjustment counts.
- Non-negative reorder thresholds.
- Unique SKU.
- Existing and active products/locations.
- Draft-only editing.
- Required delivery status progression.
- Sufficient source stock.
- Different transfer source and destination.
- Non-empty operation lines.
- Atomic validity of every line before mutation.

## Error Handling

Use:

- 400 VALIDATION_ERROR for malformed or invalid input.
- 401 UNAUTHORIZED for missing/invalid sessions.
- 404 NOT_FOUND for missing resources.
- 409 CONFLICT for uniqueness or business conflicts.
- 409 INVALID_STATUS for invalid transitions.
- 409 INSUFFICIENT_STOCK for delivery/transfer availability failures.
- 409 ALREADY_COMPLETED where a non-idempotent completion response is required.
- 500 INTERNAL_ERROR for unexpected failures.

Never expose SQL, stack traces, secrets, or internal database details.

## Security Rules

- Use HTTP-only session cookies.
- Use Secure cookies in production and SameSite=Lax.
- Apply CSRF protection or equivalent same-origin protection to state-changing cookie requests.
- Hash passwords with a vetted library.
- Use parameterized SQL.
- Restrict CORS to the approved frontend origin.
- Use environment variables for credentials.
- Enforce authorization on every protected route.
- Never trust frontend stock quantities or audit users.
- Do not expose product or location deletion.

## Coding Conventions

- Prefer clear, small modules over abstractions without immediate value.
- Keep domain logic centralized.
- Avoid unnecessary third-party dependencies.
- Use descriptive names matching the API and database contract.
- Preserve ASCII unless the existing file requires otherwise.
- Add comments only for non-obvious logic.
- Keep unrelated files unchanged.
- Do not silently resolve requirement conflicts.
- Do not change DATABASE.md or API_CONTRACT.md without explicit approval.

## Folder Structure

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

## Development Boundaries

- Implement P0 before P1.
- Implement P1 before P2.
- Do not install dependencies without explicit instruction.
- Do not create optional infrastructure before the core lifecycle works.
- Do not commit or push automatically.
- Do not modify unrelated planning documents.
- Do not generate code until the user explicitly requests implementation.

## Important Do-Not-Do Rules

- Do not invent requirements.
- Do not silently change business rules.
- Do not change API paths or response contracts without approval.
- Do not change the database design without approval.
- Do not use client-side stock mutation.
- Do not permit negative stock in the MVP.
- Do not apply Draft, Picked, Packed, or Canceled operations to stock.
- Do not apply a validation twice.
- Do not partially apply a multi-line operation.
- Do not delete products, locations, operations, or historical ledger records.
- Do not add microservices, Redis, queues, or external integrations for the MVP.
- Do not build P2 features before the complete receive -> transfer -> deliver -> adjust -> ledger path works.
