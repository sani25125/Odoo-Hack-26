CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name varchar(160) NOT NULL,
  role varchar(30) NOT NULL DEFAULT 'OPERATOR' CHECK (role IN ('ADMIN', 'OPERATOR')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(160) NOT NULL UNIQUE,
  code varchar(50) NOT NULL UNIQUE,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL,
  code varchar(50) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, name),
  UNIQUE (warehouse_id, code)
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(100) NOT NULL UNIQUE,
  name varchar(200) NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE RESTRICT,
  unit varchar(30) NOT NULL DEFAULT 'unit',
  reorder_threshold numeric(18,3) NOT NULL DEFAULT 0 CHECK (reorder_threshold >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(80) NOT NULL UNIQUE,
  operation_type varchar(20) NOT NULL CHECK (operation_type IN ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT')),
  status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PICKED', 'PACKED', 'DONE', 'CANCELED')),
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  validated_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  validated_at timestamptz,
  canceled_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'DONE') = (validated_at IS NOT NULL AND validated_by IS NOT NULL)),
  CHECK ((status = 'CANCELED') = (canceled_at IS NOT NULL AND canceled_by IS NOT NULL)),
  CHECK (operation_type = 'DELIVERY' OR status NOT IN ('PICKED', 'PACKED'))
);

CREATE TABLE IF NOT EXISTS receipts (
  operation_id uuid PRIMARY KEY REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  destination_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  supplier_reference varchar(120),
  received_at timestamptz
);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES receipts(operation_id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (operation_id, product_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
  operation_id uuid PRIMARY KEY REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  source_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  customer_reference varchar(120),
  delivered_at timestamptz
);

CREATE TABLE IF NOT EXISTS delivery_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES deliveries(operation_id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (operation_id, product_id)
);

CREATE TABLE IF NOT EXISTS transfers (
  operation_id uuid PRIMARY KEY REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  source_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  destination_location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  CHECK (source_location_id <> destination_location_id)
);

CREATE TABLE IF NOT EXISTS transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES transfers(operation_id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric(18,3) NOT NULL CHECK (quantity > 0),
  UNIQUE (operation_id, product_id)
);

CREATE TABLE IF NOT EXISTS adjustments (
  operation_id uuid PRIMARY KEY REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  reason text NOT NULL
);

CREATE TABLE IF NOT EXISTS adjustment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES adjustments(operation_id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  physical_counted_quantity numeric(18,3) NOT NULL CHECK (physical_counted_quantity >= 0),
  recorded_quantity_before numeric(18,3),
  stock_quantity_after numeric(18,3),
  difference numeric(18,3),
  UNIQUE (operation_id, product_id),
  CHECK (recorded_quantity_before IS NULL OR recorded_quantity_before >= 0),
  CHECK (stock_quantity_after IS NULL OR stock_quantity_after >= 0)
);

CREATE TABLE IF NOT EXISTS stock_balances (
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity numeric(18,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, location_id)
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL REFERENCES inventory_operations(id) ON DELETE RESTRICT,
  operation_reference varchar(80) NOT NULL,
  entry_kind varchar(20) NOT NULL CHECK (entry_kind IN ('RECEIPT', 'DELIVERY', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT')),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  quantity_delta numeric(18,3) NOT NULL,
  quantity_before numeric(18,3) NOT NULL CHECK (quantity_before >= 0),
  quantity_after numeric(18,3) NOT NULL CHECK (quantity_after >= 0),
  receipt_line_id uuid REFERENCES receipt_lines(id) ON DELETE RESTRICT,
  delivery_line_id uuid REFERENCES delivery_lines(id) ON DELETE RESTRICT,
  transfer_line_id uuid REFERENCES transfer_lines(id) ON DELETE RESTRICT,
  adjustment_line_id uuid REFERENCES adjustment_lines(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (quantity_after = quantity_before + quantity_delta),
  CHECK (num_nonnulls(receipt_line_id, delivery_line_id, transfer_line_id, adjustment_line_id) = 1),
  CHECK ((entry_kind = 'RECEIPT') = (receipt_line_id IS NOT NULL)),
  CHECK ((entry_kind = 'DELIVERY') = (delivery_line_id IS NOT NULL)),
  CHECK ((entry_kind IN ('TRANSFER_OUT', 'TRANSFER_IN')) = (transfer_line_id IS NOT NULL)),
  CHECK ((entry_kind = 'ADJUSTMENT') = (adjustment_line_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_ledger_operation_line_kind
  ON stock_ledger (
    operation_id,
    entry_kind,
    COALESCE(receipt_line_id, delivery_line_id, transfer_line_id, adjustment_line_id)
  );

CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_operations_type_status ON inventory_operations (operation_type, status);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON inventory_operations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipt_lines_product ON receipt_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_product ON delivery_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_transfer_lines_product ON transfer_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_adjustment_lines_product ON adjustment_lines (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_location ON stock_ledger (product_id, location_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_operation ON stock_ledger (operation_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_created_at ON stock_ledger (created_at DESC);
