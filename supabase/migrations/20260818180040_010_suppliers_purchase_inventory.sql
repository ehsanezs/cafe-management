/*
# Phase 3 — Suppliers, Purchase Orders, Stock Movements, Inventory

## Purpose
Creates the inventory and procurement system:
- `suppliers` — vendor master data
- `purchase_orders` — header for POs (draft → sent → partially_received → received → cancelled)
- `purchase_order_items` — line items per PO with qty, unit price, received qty
- `stock_movements` — immutable ledger of every stock in/out (purchase, sale, adjustment, waste, transfer)
- `inventory_balances` — current stock per product per branch (updated via triggers)

## New Tables

### 1. suppliers
- id, name, contact_person, phone, email, address, tax_id, payment_terms, is_active, created_at, updated_at

### 2. purchase_orders
- id, po_number (UQ), supplier_id, branch_id, status, order_date, expected_date, received_date,
  subtotal, discount_amount, tax_amount, total_amount, notes, created_by, created_at, updated_at

### 3. purchase_order_items
- id, po_id, product_id, quantity, unit_id, unit_price, discount_percent, received_quantity, line_total

### 4. stock_movements
- id, movement_date, branch_id, product_id, movement_type (purchase | sale | adjustment | waste | transfer_in | transfer_out | production),
  quantity (positive=in, negative=out), unit_id, reference_type, reference_id, notes, created_by, created_at

### 5. inventory_balances
- id, branch_id, product_id, quantity_on_hand, quantity_reserved, quantity_available (computed),
  last_movement_date, updated_at — UQ (branch_id, product_id)

## Security
- RLS enabled on all tables
- All: authenticated SELECT, INSERT, UPDATE, DELETE

## Important Notes
1. stock_movements is an immutable ledger — never UPDATE/DELETE, only INSERT.
2. inventory_balances is maintained by a trigger on stock_movements.
3. PO statuses: draft → sent → partially_received → received → cancelled
4. PO total_amount is computed from items + discount + tax at the application layer.
5. Receiving a PO creates stock_movements and updates inventory.
*/

-- ============================================================
-- 1. suppliers
-- ============================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  tax_id          text,
  payment_terms   text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_suppliers" ON suppliers;
CREATE POLICY "select_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_suppliers" ON suppliers;
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_suppliers" ON suppliers;
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_suppliers" ON suppliers;
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS suppliers_updated_at ON suppliers;
CREATE TRIGGER suppliers_updated_at
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. purchase_orders
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number         text UNIQUE NOT NULL,
  supplier_id       uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  branch_id         uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  status            text NOT NULL DEFAULT 'draft',
  order_date        timestamptz NOT NULL DEFAULT now(),
  expected_date     timestamptz,
  received_date     timestamptz,
  subtotal          numeric(18,2) DEFAULT 0,
  discount_amount   numeric(18,2) DEFAULT 0,
  tax_amount        numeric(18,2) DEFAULT 0,
  total_amount      numeric(18,2) DEFAULT 0,
  notes             text,
  created_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_purchase_orders" ON purchase_orders;
CREATE POLICY "select_purchase_orders" ON purchase_orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_purchase_orders" ON purchase_orders;
CREATE POLICY "insert_purchase_orders" ON purchase_orders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_purchase_orders" ON purchase_orders;
CREATE POLICY "update_purchase_orders" ON purchase_orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_purchase_orders" ON purchase_orders;
CREATE POLICY "delete_purchase_orders" ON purchase_orders FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. purchase_order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id               uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity            numeric(18,4) NOT NULL,
  unit_id             uuid NOT NULL REFERENCES units(id),
  unit_price          numeric(18,2) NOT NULL,
  discount_percent    numeric(5,2) DEFAULT 0,
  received_quantity   numeric(18,4) DEFAULT 0,
  line_total          numeric(18,2) NOT NULL DEFAULT 0
);

ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_purchase_order_items" ON purchase_order_items;
CREATE POLICY "select_purchase_order_items" ON purchase_order_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_purchase_order_items" ON purchase_order_items;
CREATE POLICY "insert_purchase_order_items" ON purchase_order_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_purchase_order_items" ON purchase_order_items;
CREATE POLICY "update_purchase_order_items" ON purchase_order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_purchase_order_items" ON purchase_order_items;
CREATE POLICY "delete_purchase_order_items" ON purchase_order_items FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_po_items_product ON purchase_order_items(product_id);

-- ============================================================
-- 4. stock_movements
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_movements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date   timestamptz NOT NULL DEFAULT now(),
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  product_id      uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  movement_type   text NOT NULL,
  quantity        numeric(18,4) NOT NULL,
  unit_id         uuid NOT NULL REFERENCES units(id),
  reference_type  text,
  reference_id    uuid,
  notes           text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_stock_movements" ON stock_movements;
CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_stock_movements" ON stock_movements;
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT
  TO authenticated WITH CHECK (true);

-- No UPDATE or DELETE policy — stock_movements is an immutable ledger

CREATE INDEX IF NOT EXISTS idx_stock_mov_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_branch ON stock_movements(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_mov_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_mov_type ON stock_movements(movement_type);

-- ============================================================
-- 5. inventory_balances
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_balances (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id          uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id         uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_on_hand    numeric(18,4) NOT NULL DEFAULT 0,
  quantity_reserved   numeric(18,4) NOT NULL DEFAULT 0,
  last_movement_date  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, product_id)
);

ALTER TABLE inventory_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_inventory_balances" ON inventory_balances;
CREATE POLICY "select_inventory_balances" ON inventory_balances FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_inventory_balances" ON inventory_balances;
CREATE POLICY "insert_inventory_balances" ON inventory_balances FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_inventory_balances" ON inventory_balances;
CREATE POLICY "update_inventory_balances" ON inventory_balances FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_inventory_balances" ON inventory_balances;
CREATE POLICY "delete_inventory_balances" ON inventory_balances FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_inv_balance_product ON inventory_balances(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_balance_branch ON inventory_balances(branch_id);

-- ============================================================
-- Trigger: auto-update inventory_balances on stock_movements INSERT
-- ============================================================
CREATE OR REPLACE FUNCTION update_inventory_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventory_balances (branch_id, product_id, quantity_on_hand, last_movement_date, updated_at)
  VALUES (NEW.branch_id, NEW.product_id, NEW.quantity, NEW.movement_date, now())
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET
    quantity_on_hand = inventory_balances.quantity_on_hand + NEW.quantity,
    last_movement_date = NEW.movement_date,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stock_movements_update_balance ON stock_movements;
CREATE TRIGGER stock_movements_update_balance
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION update_inventory_balance();

REVOKE EXECUTE ON FUNCTION update_inventory_balance() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_inventory_balance() TO authenticated;

-- ============================================================
-- Seed: number sequences for purchase orders (per branch)
-- ============================================================
INSERT INTO number_sequences (branch_id, sequence_key, prefix, next_value, padding)
SELECT b.id, 'purchase_order', 'PO-', 1, 5
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM number_sequences ns WHERE ns.branch_id = b.id AND ns.sequence_key = 'purchase_order'
);

-- Seed: a demo supplier
INSERT INTO suppliers (name, contact_person, phone, email, is_active)
SELECT 'تأمین‌کننده نمونه', 'آقای احمدی', '02112345678', 'supplier@example.com', true
WHERE NOT EXISTS (SELECT 1 FROM suppliers LIMIT 1);
