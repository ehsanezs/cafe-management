/*
# Phase 6 — CRM: Customers & Loyalty

## Purpose
Creates the customer management system:
- `customers` — customer master data with loyalty points and visit history

## New Tables

### 1. customers
- id, full_name, phone, email, address, birth_date
- loyalty_points, total_visits, total_spent
- is_active, notes
- created_at, updated_at

## Security
- RLS enabled, authenticated CRUD

## Important Notes
1. Loyalty points are calculated based on settings.loyalty_points_per_toman.
2. total_visits and total_spent are updated when orders are linked to a customer (future enhancement).
3. Phone number is the primary identifier for customers in POS.
*/

CREATE TABLE IF NOT EXISTS customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  phone           text UNIQUE,
  email           text,
  address         text,
  birth_date      date,
  loyalty_points  integer NOT NULL DEFAULT 0,
  total_visits    integer NOT NULL DEFAULT 0,
  total_spent     numeric(18,2) NOT NULL DEFAULT 0,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customers" ON customers;
CREATE POLICY "select_customers" ON customers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_customers" ON customers;
CREATE POLICY "insert_customers" ON customers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_customers" ON customers;
CREATE POLICY "update_customers" ON customers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_customers" ON customers;
CREATE POLICY "delete_customers" ON customers FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);

-- Seed: a demo customer
INSERT INTO customers (full_name, phone, email, is_active)
SELECT 'مشتری نمونه', '09120000000', 'customer@example.com', true
WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);
