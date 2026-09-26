Final Implementation Specification
P0 — MUST IMPLEMENT
- Demo login, session persistence, logout, and dashboard redirect
- One warehouse with multiple locations
- Product creation and update
- SKU uniqueness
- Product category, unit, reorder threshold, and optional initial stock
- Stock balances by product and location
- Receipt creation, Draft state, validation, and stock increase
- Delivery creation, picking, packing, validation, and stock decrease
- Internal transfer between locations
- Physical stock adjustment
- Dashboard stock and pending-operation summaries
- Low-stock and out-of-stock display
- Movement ledger
- User and timestamp tracking
- Draft and canceled stock protection
- Idempotent validation
- Atomic multi-line operations
- Positive movement quantities
- Prevention of negative stock
- Complete receive → transfer → deliver → adjust → ledger demo path
P1 — IMPLEMENT ONLY AFTER P0
- Basic operation filters
- Category filtering
- Product search
- Stock-by-location summary view
- Seeded demo data
- Mocked OTP reset
- More detailed status labels
- Delivery exception indicators
- Stock-change drill-down
P2 — OPTIONAL
- Product stock-flow timeline
- Polished exception dashboard
- Enhanced status visualization
- Compact visual lifecycle presentation