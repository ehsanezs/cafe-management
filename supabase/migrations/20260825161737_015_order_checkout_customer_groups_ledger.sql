/*
# Order checkout fields, customer groups, and ledger balance

## Summary
This migration adds new columns to support enhanced POS checkout (packaging cost, delivery cost, customer info),
creates a customer groups table for grouping customers, adds a ledger balance column to customers for "حساب دفتری"
(book account) payments, and links orders to customers.

## New Tables
- `customer_groups`
  - `id` (uuid, primary key)
  - `name` (text, not null) — group name (e.g. VIP, معمولی)
  - `description` (text, nullable)
  - `discount_percent` (numeric, default 0) — default discount for this group
  - `is_active` (boolean, default true)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Modified Tables
- `orders` — added columns:
  - `packaging_cost` (numeric, default 0) — هزینه بسته‌بندی
  - `delivery_cost` (numeric, default 0) — هزینه ارسال
  - `customer_id` (uuid, nullable) — links to customers table for ledger tracking
  - `customer_name` (text, nullable) — نام مشتری (for walk-in / non-registered customers)
  - `customer_phone` (text, nullable) — شماره موبایل مشتری
  - `customer_group_id` (uuid, nullable) — links to customer_groups

- `customers` — added columns:
  - `group_id` (uuid, nullable) — links to customer_groups
  - `ledger_balance` (numeric, default 0) — حساب دفتری (positive = customer owes, negative = credit)

## Security
- RLS enabled on `customer_groups` with full CRUD for authenticated users.
- Existing policies on `orders` and `customers` already allow authenticated CRUD with `true` predicates.

## Important Notes
1. All new columns are nullable or have defaults so existing rows are unaffected.
2. Foreign keys use ON DELETE SET NULL to avoid data loss.
3. The `customer_groups` table follows the same RLS pattern as other tables (authenticated CRUD).
*/

-- ============================================================
-- 1. Create customer_groups table
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_percent numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customer_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_customer_groups" ON customer_groups;
CREATE POLICY "select_customer_groups" ON customer_groups FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_customer_groups" ON customer_groups;
CREATE POLICY "insert_customer_groups" ON customer_groups FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_customer_groups" ON customer_groups;
CREATE POLICY "update_customer_groups" ON customer_groups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_customer_groups" ON customer_groups;
CREATE POLICY "delete_customer_groups" ON customer_groups FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. Add columns to orders table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='packaging_cost') THEN
    ALTER TABLE orders ADD COLUMN packaging_cost numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='delivery_cost') THEN
    ALTER TABLE orders ADD COLUMN delivery_cost numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_id') THEN
    ALTER TABLE orders ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_name') THEN
    ALTER TABLE orders ADD COLUMN customer_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_phone') THEN
    ALTER TABLE orders ADD COLUMN customer_phone text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='customer_group_id') THEN
    ALTER TABLE orders ADD COLUMN customer_group_id uuid REFERENCES customer_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- 3. Add columns to customers table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='group_id') THEN
    ALTER TABLE customers ADD COLUMN group_id uuid REFERENCES customer_groups(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='customers' AND column_name='ledger_balance') THEN
    ALTER TABLE customers ADD COLUMN ledger_balance numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 4. Add payment_method constraint note: we use text so no constraint needed.
--    Payment methods are now: cash, pos, card_transfer, online, wallet, ledger
-- ============================================================

-- ============================================================
-- 5. Seed a default customer group
-- ============================================================
INSERT INTO customer_groups (name, description, discount_percent, is_active)
SELECT 'مشتریان عادی', 'گروه پیش‌فرض برای همه مشتریان', 0, true
WHERE NOT EXISTS (SELECT 1 FROM customer_groups WHERE name = 'مشتریان عادی');
