/*
# Phase 2 — Recipes, Recipe Versions, Recipe Items, Modifiers, Yields

## Purpose
Creates the versioned recipe system:
- `recipes` — one active recipe per product (finished or semi_finished)
- `recipe_versions` — immutable published versions with calculated cost
- `recipe_items` — ingredients in each version with quantity, waste, cost snapshot
- `modifier_groups` — add-on groups (extra cheese, no onion)
- `modifier_items` — individual modifiers with price and recipe delta
- `ingredient_yields` — raw-to-usable yield tracking (e.g. 1kg raw meat → 800g usable)

## New Tables

### 1. recipes
- `id` (uuid PK)
- `product_id` (uuid FK → products, UQ) — one recipe per product
- `is_active` (bool NN, default true)
- `created_at` (timestamptz NN)

### 2. recipe_versions
- `id` (uuid PK)
- `recipe_id` (uuid FK → recipes NN)
- `version_number` (int NN)
- `status` (text NN) — draft | active | superseded
- `effective_from` (timestamptz NN)
- `superseded_at` (timestamptz NULL)
- `calculated_cost_per_serving` (numeric 18,2) — cost at publish time
- `published_by` (uuid FK → users)
- `created_at` (timestamptz NN)
- UQ (recipe_id, version_number)

### 3. recipe_items
- `id` (uuid PK)
- `recipe_version_id` (uuid FK → recipe_versions NN)
- `ingredient_product_id` (uuid FK → products NN) — ingredient or semi_finished
- `quantity` (numeric 18,4 NN)
- `unit_id` (uuid FK → units NN)
- `waste_percent` (numeric 5,2, default 0) — waste allowance
- `cost_at_publish` (numeric 18,2) — cost snapshot when version published
- `substitute_ingredient_id` (uuid FK → products, NULL) — alternative ingredient
- `created_at` (timestamptz NN)

### 4. modifier_groups
- `id` (uuid PK)
- `name` (text NN)
- `product_id` (uuid FK → products, NULL) — NULL = global, applies to all
- `is_active` (bool NN, default true)

### 5. modifier_items
- `id` (uuid PK)
- `modifier_group_id` (uuid FK → modifier_groups NN)
- `name` (text NN)
- `price_modifier` (numeric 18,2, default 0)
- `recipe_delta` (jsonb) — [{"product_id":"...","quantity":20,"unit_id":"..."}]
- `is_active` (bool NN, default true)

### 6. ingredient_yields
- `id` (uuid PK)
- `ingredient_product_id` (uuid FK → products, UQ)
- `raw_quantity` (numeric 18,4 NN)
- `raw_unit_id` (uuid FK → units NN)
- `usable_quantity` (numeric 18,4 NN)
- `usable_unit_id` (uuid FK → units NN)
- `yield_percent` (numeric 5,2) — computed: usable/raw × 100
- `created_at` (timestamptz NN)

## Security
- RLS enabled on all tables.
- All tables: authenticated users can SELECT.
- INSERT/UPDATE/DELETE for authenticated users (permission enforcement in later phases).

## Important Notes
1. recipe_versions are immutable once published (status = 'active'). New versions supersede old ones.
2. cost_at_publish is a snapshot — when ingredient prices change, old recipe versions keep their cost.
3. calculated_cost_per_serving is computed at publish time from ingredient costs + waste.
4. modifier_items.recipe_delta allows modifiers to affect ingredient consumption (e.g. "extra cheese" adds 20g cheese).
5. ingredient_yields track raw-to-usable conversion (e.g. 1kg raw chicken → 800g usable = 80% yield).
*/

-- ============================================================
-- 1. recipes
-- ============================================================
CREATE TABLE IF NOT EXISTS recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_recipes" ON recipes;
CREATE POLICY "select_recipes" ON recipes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_recipes" ON recipes;
CREATE POLICY "insert_recipes" ON recipes FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recipes" ON recipes;
CREATE POLICY "update_recipes" ON recipes FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recipes" ON recipes;
CREATE POLICY "delete_recipes" ON recipes FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. recipe_versions
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_versions (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id                   uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  version_number              int NOT NULL,
  status                      text NOT NULL DEFAULT 'draft',
  effective_from              timestamptz NOT NULL DEFAULT now(),
  superseded_at               timestamptz,
  calculated_cost_per_serving numeric(18,2),
  published_by                uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recipe_id, version_number)
);

ALTER TABLE recipe_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_recipe_versions" ON recipe_versions;
CREATE POLICY "select_recipe_versions" ON recipe_versions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_recipe_versions" ON recipe_versions;
CREATE POLICY "insert_recipe_versions" ON recipe_versions FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recipe_versions" ON recipe_versions;
CREATE POLICY "update_recipe_versions" ON recipe_versions FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recipe_versions" ON recipe_versions;
CREATE POLICY "delete_recipe_versions" ON recipe_versions FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 3. recipe_items
-- ============================================================
CREATE TABLE IF NOT EXISTS recipe_items (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_version_id        uuid NOT NULL REFERENCES recipe_versions(id) ON DELETE CASCADE,
  ingredient_product_id   uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity                 numeric(18,4) NOT NULL,
  unit_id                  uuid NOT NULL REFERENCES units(id),
  waste_percent            numeric(5,2) DEFAULT 0,
  cost_at_publish           numeric(18,2),
  substitute_ingredient_id uuid REFERENCES products(id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_recipe_items" ON recipe_items;
CREATE POLICY "select_recipe_items" ON recipe_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_recipe_items" ON recipe_items;
CREATE POLICY "insert_recipe_items" ON recipe_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_recipe_items" ON recipe_items;
CREATE POLICY "update_recipe_items" ON recipe_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_recipe_items" ON recipe_items;
CREATE POLICY "delete_recipe_items" ON recipe_items FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 4. modifier_groups
-- ============================================================
CREATE TABLE IF NOT EXISTS modifier_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  product_id  uuid REFERENCES products(id) ON DELETE CASCADE,
  is_active   boolean NOT NULL DEFAULT true
);

ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_modifier_groups" ON modifier_groups;
CREATE POLICY "select_modifier_groups" ON modifier_groups FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_modifier_groups" ON modifier_groups;
CREATE POLICY "insert_modifier_groups" ON modifier_groups FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_modifier_groups" ON modifier_groups;
CREATE POLICY "update_modifier_groups" ON modifier_groups FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_modifier_groups" ON modifier_groups;
CREATE POLICY "delete_modifier_groups" ON modifier_groups FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 5. modifier_items
-- ============================================================
CREATE TABLE IF NOT EXISTS modifier_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_group_id uuid NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name               text NOT NULL,
  price_modifier     numeric(18,2) DEFAULT 0,
  recipe_delta       jsonb,
  is_active          boolean NOT NULL DEFAULT true
);

ALTER TABLE modifier_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_modifier_items" ON modifier_items;
CREATE POLICY "select_modifier_items" ON modifier_items FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_modifier_items" ON modifier_items;
CREATE POLICY "insert_modifier_items" ON modifier_items FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_modifier_items" ON modifier_items;
CREATE POLICY "update_modifier_items" ON modifier_items FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_modifier_items" ON modifier_items;
CREATE POLICY "delete_modifier_items" ON modifier_items FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 6. ingredient_yields
-- ============================================================
CREATE TABLE IF NOT EXISTS ingredient_yields (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_product_id uuid UNIQUE NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  raw_quantity           numeric(18,4) NOT NULL,
  raw_unit_id            uuid NOT NULL REFERENCES units(id),
  usable_quantity        numeric(18,4) NOT NULL,
  usable_unit_id         uuid NOT NULL REFERENCES units(id),
  yield_percent          numeric(5,2),
  created_at             timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ingredient_yields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_ingredient_yields" ON ingredient_yields;
CREATE POLICY "select_ingredient_yields" ON ingredient_yields FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_ingredient_yields" ON ingredient_yields;
CREATE POLICY "insert_ingredient_yields" ON ingredient_yields FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_ingredient_yields" ON ingredient_yields;
CREATE POLICY "update_ingredient_yields" ON ingredient_yields FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_ingredient_yields" ON ingredient_yields;
CREATE POLICY "delete_ingredient_yields" ON ingredient_yields FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_recipe_versions_recipe ON recipe_versions(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_versions_status ON recipe_versions(status);
CREATE INDEX IF NOT EXISTS idx_recipe_items_version ON recipe_items(recipe_version_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_ingredient ON recipe_items(ingredient_product_id);
CREATE INDEX IF NOT EXISTS idx_modifier_groups_product ON modifier_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_modifier_items_group ON modifier_items(modifier_group_id);
