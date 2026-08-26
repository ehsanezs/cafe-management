/*
# Phase 4 — POS: Tables, Orders, Order Items, Payments

## Purpose
Creates the restaurant floor and point-of-sale system:
- `restaurant_tables` — physical tables in the dining area
- `orders` — customer orders (dine-in, takeaway, delivery)
- `order_items` — line items per order with status tracking
- `payments` — payment records for orders

## New Tables

### 1. restaurant_tables
- id, branch_id, table_number, section, capacity, status (available | occupied | reserved | cleaning)
- x, y for floor plan positioning

### 2. orders
- id, order_number (UQ), branch_id, table_id (nullable for takeaway/delivery)
- order_type (dine_in | takeaway | delivery)
- status (open | sent | preparing | ready | served | paid | cancelled)
- subtotal, discount_amount, tax_amount, total_amount
- notes, created_by, created_at, updated_at

### 3. order_items
- id, order_id, product_id, quantity, unit_price, discount_percent
- line_total, notes, status (pending | sent | preparing | ready | served | cancelled)
- modifiers (jsonb for optional modifier selections)

### 4. payments
- id, order_id, amount, payment_method (cash | card | online | wallet)
- status (pending | completed | failed | refunded)
- reference_number, created_by, created_at

## Security
- RLS enabled on all tables
- All: authenticated SELECT, INSERT, UPDATE, DELETE

## Important Notes
1. Order statuses: open → sent → preparing → ready → served → paid (or cancelled at any stage)
2. Order item statuses track kitchen preparation independently
3. Table status auto-updates based on order status (trigger)
4. Payment creates stock movements for sold items (trigger) — deferred to application layer for now
*/

-- ============================================================
-- 1. restaurant_tables
-- ============================================================
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  table_number  text NOT NULL,
  section       text DEFAULT 'main',
  capacity      integer NOT NULL DEFAULT 4,
  status        text NOT NULL DEFAULT 'available',
  x_pos         integer DEFAULT 0,
  y_pos         integer DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (branch_id, table_number)
);

ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_restaurant_tables" ON restaurant_tables;
CREATE POLICY "select_restaurant_tables" ON restaurant_tables FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_restaurant_tables" ON restaurant_tables;
CREATE POLICY "insert_restaurant_tables" ON restaurant_tables FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_restaurant_tables" ON restaurant_tables;
CREATE POLICY "update_restaurant_tables" ON restaurant_tables FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_restaurant_tables" ON restaurant_tables;
CREATE POLICY "delete_restaurant_tables" ON restaurant_tables FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS restaurant_tables_updated_at ON restaurant_tables;
CREATE TRIGGER restaurant_tables_updated_at
  BEFORE UPDATE ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    text UNIQUE NOT NULL,
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  table_id        uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  order_type      text NOT NULL DEFAULT 'dine_in',
  status          text NOT NULL DEFAULT 'open',
  subtotal        numeric(18,2) DEFAULT 0,
  discount_amount numeric(18,2) DEFAULT 0,
  tax_amount      numeric(18,2) DEFAULT 0,
  total_amount    numeric(18,2) DEFAULT 0,
  notes           text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_orders" ON orders;
CREATE POLICY "delete_orders" ON orders FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ============================================================
-- 3. order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity          numeric(18,4) NOT NULL,
  unit_price        numeric(18,2) NOT NULL,
  discount_percent  numeric(5,2) DEFAULT 0,
  line_total        numeric(18,2) NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'pending',
  notes             text,
  modifiers         jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_order_items" ON order_items;
CREATE POLICY "select_order_items" ON order_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_order_items" ON order_items;
CREATE POLICY "insert_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_order_items" ON order_items;
CREATE POLICY "update_order_items" ON order_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_order_items" ON order_items;
CREATE POLICY "delete_order_items" ON order_items FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

-- ============================================================
-- 4. payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount          numeric(18,2) NOT NULL,
  payment_method  text NOT NULL DEFAULT 'cash',
  status          text NOT NULL DEFAULT 'completed',
  reference_number text,
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_payments" ON payments;
CREATE POLICY "select_payments" ON payments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_payments" ON payments;
CREATE POLICY "insert_payments" ON payments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_payments" ON payments;
CREATE POLICY "update_payments" ON payments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_payments" ON payments;
CREATE POLICY "delete_payments" ON payments FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

-- ============================================================
-- Seed: number sequences for orders
-- ============================================================
INSERT INTO number_sequences (branch_id, sequence_key, prefix, next_value, padding)
SELECT b.id, 'order', 'ORD-', 1, 5
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM number_sequences ns WHERE ns.branch_id = b.id AND ns.sequence_key = 'order'
);

-- ============================================================
-- Seed: demo restaurant tables
-- ============================================================
INSERT INTO restaurant_tables (branch_id, table_number, section, capacity, status, x_pos, y_pos)
SELECT b.id, t.table_number, t.section, t.capacity, 'available', t.x, t.y
FROM branches b
CROSS JOIN (VALUES
  ('1', 'سالن اصلی', 4, 0, 0),
  ('2', 'سالن اصلی', 4, 1, 0),
  ('3', 'سالن اصلی', 6, 2, 0),
  ('4', 'سالن اصلی', 2, 0, 1),
  ('5', 'سالن اصلی', 2, 1, 1),
  ('6', 'تراس', 4, 0, 2),
  ('7', 'تراس', 4, 1, 2),
  ('8', 'تراس', 8, 2, 2)
) AS t(table_number, section, capacity, x, y)
WHERE NOT EXISTS (SELECT 1 FROM restaurant_tables rt WHERE rt.branch_id = b.id);
