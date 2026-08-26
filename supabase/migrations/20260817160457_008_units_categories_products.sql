/*
# Phase 2 — Units, Categories, Products

## Purpose
Creates the product catalog foundation:
- `units` — measurement units (gram, kg, ml, liter, piece, etc.) with base-unit conversions
- `unit_conversions` — conversion factors between units (e.g. 1 kg = 1000 g)
- `product_categories` — hierarchical product categories
- `products` — the main product/ingredient table with type, pricing, tax, stock thresholds

## New Tables

### 1. units
- `id` (uuid PK)
- `name` (text UQ) — e.g. "کیلوگرم", "گرم", "عدد"
- `symbol` (text NN) — e.g. "kg", "g", "pcs"
- `is_base` (bool) — is this a base unit?
- `base_unit_id` (uuid FK → units, NULL) — reference base unit
- `base_factor` (numeric) — multiplier to convert to base unit (e.g. kg→g: 1000)

### 2. unit_conversions
- `id` (uuid PK)
- UQ (from_unit_id, to_unit_id)
- `from_unit_id` (uuid FK → units)
- `to_unit_id` (uuid FK → units)
- `factor` (numeric NN) — multiply quantity in from_unit by this to get to_unit

### 3. product_categories
- `id` (uuid PK)
- `name` (text UQ)
- `parent_id` (uuid FK → product_categories, NULL for root)
- `display_order` (int, default 0)
- `is_active` (bool NN, default true)

### 4. products
- `id` (uuid PK)
- `sku` (text UQ) — stock keeping unit
- `barcode` (text)
- `name` (text NN)
- `description` (text)
- `image_url` (text)
- `category_id` (uuid FK → product_categories)
- `product_type` (text NN) — finished | ingredient | semi_finished | purchased
- `unit_id` (uuid FK → units NN) — base selling/purchasing unit
- `sale_price` (numeric 18,2) — retail price for finished products
- `purchase_price` (numeric 18,2) — last known purchase price for ingredients
- `tax_rate` (numeric 5,2, default 0) — default tax rate, overridable per order
- `max_discount_percent` (numeric 5,2, default 100)
- `is_active` (bool NN, default true)
- `min_stock` (numeric 18,4) — reorder threshold
- `max_stock` (numeric 18,4) — max stock level
- `packaging_cost` (numeric 18,2, default 0)
- `target_food_cost_percent` (numeric 5,2) — target food cost for this product
- `created_at`, `updated_at` (timestamptz)

## Security
- RLS enabled on all tables.
- All tables: authenticated users can SELECT (catalog data is shared across the restaurant).
- products: INSERT/UPDATE/DELETE for authenticated users (will be restricted by permission checks in later phases).
- units, unit_conversions, product_categories: same pattern.

## Important Notes
1. Units support base-unit conversion (e.g. kg → g with factor 1000).
2. product_categories support hierarchical parent-child relationships.
3. products.product_type determines behavior: "finished" = sellable item, "ingredient" = raw material, "semi_finished" = intermediate, "purchased" = bought-not-made.
4. sale_price is for finished products; purchase_price is for ingredients/purchased items.
5. tax_rate is a default — the actual rate is snapshotted per order.
*/

-- ============================================================
-- 1. units
-- ============================================================
CREATE TABLE IF NOT EXISTS units (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  symbol        text NOT NULL,
  is_base       boolean NOT NULL DEFAULT false,
  base_unit_id  uuid REFERENCES units(id) ON DELETE SET NULL,
  base_factor   numeric(18,6) DEFAULT 1
);

ALTER TABLE units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_units" ON units;
CREATE POLICY "select_units" ON units FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_units" ON units;
CREATE POLICY "insert_units" ON units FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_units" ON units;
CREATE POLICY "update_units" ON units FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_units" ON units;
CREATE POLICY "delete_units" ON units FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. unit_conversions
-- ============================================================
CREATE TABLE IF NOT EXISTS unit_conversions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_unit_id  uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  to_unit_id    uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  factor        numeric(18,6) NOT NULL,
  UNIQUE (from_unit_id, to_unit_id)
);

ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_unit_conversions" ON unit_conversions;
CREATE POLICY "select_unit_conversions" ON unit_conversions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_unit_conversions" ON unit_conversions;
CREATE POLICY "insert_unit_conversions" ON unit_conversions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_unit_conversions" ON unit_conversions;
CREATE POLICY "update_unit_conversions" ON unit_conversions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_unit_conversions" ON unit_conversions;
CREATE POLICY "delete_unit_conversions" ON unit_conversions FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. product_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS product_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  parent_id     uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true
);

ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_product_categories" ON product_categories;
CREATE POLICY "select_product_categories" ON product_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_product_categories" ON product_categories;
CREATE POLICY "insert_product_categories" ON product_categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_product_categories" ON product_categories;
CREATE POLICY "update_product_categories" ON product_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_product_categories" ON product_categories;
CREATE POLICY "delete_product_categories" ON product_categories FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                       text UNIQUE,
  barcode                   text,
  name                      text NOT NULL,
  description               text,
  image_url                 text,
  category_id               uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  product_type              text NOT NULL DEFAULT 'finished',
  unit_id                   uuid NOT NULL REFERENCES units(id),
  sale_price                numeric(18,2) DEFAULT 0,
  purchase_price            numeric(18,2) DEFAULT 0,
  tax_rate                  numeric(5,2) DEFAULT 0,
  max_discount_percent      numeric(5,2) DEFAULT 100,
  is_active                 boolean NOT NULL DEFAULT true,
  min_stock                 numeric(18,4) DEFAULT 0,
  max_stock                 numeric(18,4),
  packaging_cost            numeric(18,2) DEFAULT 0,
  target_food_cost_percent  numeric(5,2),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_products" ON products;
CREATE POLICY "select_products" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Triggers: updated_at
-- ============================================================
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON product_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_unit_conversions_from ON unit_conversions(from_unit_id);

-- ============================================================
-- Seed: Common units
-- ============================================================
INSERT INTO units (name, symbol, is_base, base_factor) VALUES
  ('گرم',      'g',     true,  1),
  ('کیلوگرم',  'kg',    false, 1000),
  ('میلی‌لیتر','ml',    true,  1),
  ('لیتر',     'l',     false, 1000),
  ('عدد',      'pcs',   true,  1),
  ('بسته',     'pack',  true,  1),
  ('بطری',     'btl',   true,  1),
  ('قوطی',     'can',   true,  1),
  ('پرس',      'srv',   true,  1)
ON CONFLICT (name) DO NOTHING;

-- Set base_unit_id for kg (→ g) and l (→ ml)
UPDATE units SET base_unit_id = (SELECT id FROM units WHERE name = 'گرم'), base_factor = 1000
  WHERE name = 'کیلوگرم' AND base_unit_id IS NULL;
UPDATE units SET base_unit_id = (SELECT id FROM units WHERE name = 'میلی‌لیتر'), base_factor = 1000
  WHERE name = 'لیتر' AND base_unit_id IS NULL;

-- Seed unit conversions
INSERT INTO unit_conversions (from_unit_id, to_unit_id, factor)
SELECT f.id, t.id, 1000 FROM units f, units t WHERE f.name = 'کیلوگرم' AND t.name = 'گرم'
ON CONFLICT (from_unit_id, to_unit_id) DO NOTHING;

INSERT INTO unit_conversions (from_unit_id, to_unit_id, factor)
SELECT f.id, t.id, 1000 FROM units f, units t WHERE f.name = 'لیتر' AND t.name = 'میلی‌لیتر'
ON CONFLICT (from_unit_id, to_unit_id) DO NOTHING;

-- Seed common categories
INSERT INTO product_categories (name, display_order, is_active) VALUES
  ('غذاهای اصلی',     1, true),
  ('پیش‌غذا',         2, true),
  ('سالاد',           3, true),
  ('دسر',             4, true),
  ('نوشیدنی گرم',     5, true),
  ('نوشیدنی سرد',     6, true),
  ('مواد اولیه',       7, true),
  ('بسته‌بندی',        8, true)
ON CONFLICT (name) DO NOTHING;
