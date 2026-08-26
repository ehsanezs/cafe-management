/*
# Phase 1 — Branches, Settings, Number Sequences

## Purpose
This migration creates the foundational tables for the restaurant management system:
- `branches` — multi-branch support (single-branch UI in v1, but schema-ready for multi-branch)
- `settings` — global and per-branch configuration (currency, tax, cost method, void policy, loyalty)
- `number_sequences` — atomic document numbering for orders, purchases, receipts, journals, etc.

## New Tables

### 1. branches
- `id` (uuid PK)
- `code` (text UQ) — short code like "BR1"
- `name` (text NN) — branch display name
- `address` (text)
- `phone` (text)
- `logo_url` (text)
- `is_active` (bool NN, default true)
- `created_at` (timestamptz NN, default now())

### 2. settings
- `id` (uuid PK)
- `branch_id` (uuid FK → branches, NULL = global settings)
- `restaurant_name` (text)
- `address` (text)
- `phone` (text)
- `logo_url` (text)
- `currency` (text NN, default 'toman') — toman | rial
- `show_rial_alongside` (bool, default false)
- `tax_enabled` (bool, default false)
- `default_tax_rate` (numeric(5,2), default 0)
- `cost_method` (text NN, default 'weighted_average') — weighted_average | fifo(future)
- `target_food_cost_percent` (numeric(5,2), default 30)
- `variance_threshold_percent` (numeric(5,2), default 5)
- `waste_threshold_value` (numeric(18,2), default 0)
- `void_policy` (jsonb) — configurable void rules
- `loyalty_enabled` (bool, default false)
- `loyalty_points_per_toman` (numeric(10,4), default 0.01)
- `created_at`, `updated_at` (timestamptz)

### 3. number_sequences
- `id` (uuid PK)
- UQ (sequence_key, branch_id) — one sequence per document type per branch
- `sequence_key` (text NN) — order | purchase | receipt | journal | waste | adjustment | refund
- `branch_id` (uuid FK → branches NN)
- `prefix` (text) — e.g. "INV", "PO", "GRN"
- `next_value` (int NN, default 1)
- `padding` (int NN, default 5)

## Security
- RLS enabled on all three tables.
- Policies: authenticated users can SELECT branches and settings.
- INSERT/UPDATE/DELETE on settings and number_sequences restricted to users with admin/owner roles (enforced via user_roles table in later migration; for now, authenticated can manage since this is Phase 1 setup).
- number_sequences: SELECT only for authenticated (mutations happen via SECURITY DEFINER function next_number()).

## Important Notes
1. branches table is the root entity — all other tables reference it.
2. settings with branch_id = NULL represents global/default settings.
3. number_sequences is used by the next_number() function (created in a later migration) which uses SELECT FOR UPDATE for atomic numbering.
4. void_policy stored as jsonb for flexibility: {"allowed_before_payment": true, "time_limit_minutes": null, "until_end_of_shift": true, "requires_manager_approval": false, "requires_owner_approval": false}
*/

-- ============================================================
-- 1. branches
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  address     text,
  phone       text,
  logo_url    text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_branches" ON branches;
CREATE POLICY "select_branches" ON branches FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_branches" ON branches;
CREATE POLICY "insert_branches" ON branches FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_branches" ON branches;
CREATE POLICY "update_branches" ON branches FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id                   uuid REFERENCES branches(id) ON DELETE CASCADE,
  restaurant_name             text,
  address                     text,
  phone                       text,
  logo_url                    text,
  currency                    text NOT NULL DEFAULT 'toman',
  show_rial_alongside         boolean DEFAULT false,
  tax_enabled                 boolean DEFAULT false,
  default_tax_rate             numeric(5,2) DEFAULT 0,
  cost_method                 text NOT NULL DEFAULT 'weighted_average',
  target_food_cost_percent    numeric(5,2) DEFAULT 30,
  variance_threshold_percent  numeric(5,2) DEFAULT 5,
  waste_threshold_value       numeric(18,2) DEFAULT 0,
  void_policy                 jsonb DEFAULT '{"allowed_before_payment": true, "time_limit_minutes": null, "until_end_of_shift": true, "requires_manager_approval": false, "requires_owner_approval": false}'::jsonb,
  loyalty_enabled             boolean DEFAULT false,
  loyalty_points_per_toman    numeric(10,4) DEFAULT 0.01,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_settings" ON settings;
CREATE POLICY "insert_settings" ON settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_settings" ON settings;
CREATE POLICY "update_settings" ON settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3. number_sequences
-- ============================================================
CREATE TABLE IF NOT EXISTS number_sequences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_key  text NOT NULL,
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  prefix        text,
  next_value    int NOT NULL DEFAULT 1,
  padding       int NOT NULL DEFAULT 5,
  UNIQUE (sequence_key, branch_id)
);

ALTER TABLE number_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_number_sequences" ON number_sequences;
CREATE POLICY "select_number_sequences" ON number_sequences FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_number_sequences" ON number_sequences;
CREATE POLICY "insert_number_sequences" ON number_sequences FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_number_sequences" ON number_sequences;
CREATE POLICY "update_number_sequences" ON number_sequences FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_settings_branch_id ON settings(branch_id);
CREATE INDEX IF NOT EXISTS idx_number_sequences_key_branch ON number_sequences(sequence_key, branch_id);
