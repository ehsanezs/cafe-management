/*
# Phase 1 — Roles, Permissions, Role-Permissions, User-Roles

## Purpose
This migration creates the RBAC (Role-Based Access Control) foundation:
- `roles` — 8 predefined roles (owner, admin, manager, cashier, inventory_manager, kitchen, accountant, viewer)
- `permissions` — granular permissions per module (pos, inventory, accounting, crm, reports, settings, users)
- `role_permissions` — many-to-many mapping of roles to permissions
- `user_roles` — assigns roles to users per branch (a user can have different roles in different branches)

## New Tables

### 1. roles
- `id` (uuid PK)
- `name` (text UQ) — owner | admin | manager | cashier | inventory_manager | kitchen | accountant | viewer
- `display_name` (text NN) — Persian display name
- `description` (text)

### 2. permissions
- `id` (uuid PK)
- `code` (text UQ) — e.g. "pos.sale.create", "inventory.adjust", "reports.view"
- `display_name` (text NN)
- `module` (text NN) — pos | inventory | accounting | crm | reports | settings | users

### 3. role_permissions
- PK (role_id + permission_id)
- `role_id` (uuid FK → roles)
- `permission_id` (uuid FK → permissions)

### 4. user_roles
- PK (user_id + role_id + branch_id)
- `user_id` (uuid FK → users)
- `role_id` (uuid FK → roles)
- `branch_id` (uuid FK → branches)
- `assigned_by` (uuid FK → users, NULL)
- `assigned_at` (timestamptz NN, default now())

## Security
- RLS enabled on all tables.
- SELECT: authenticated users can read roles, permissions, role_permissions, and their own user_roles.
- user_roles: users can only INSERT/UPDATE/DELETE their own role assignments (or if they have admin role — enforced later via SECURITY DEFINER functions; for now, authenticated can manage).
- role_permissions: SELECT only for authenticated (mutations via seed/admin functions).

## Important Notes
1. The 8 roles match the specification exactly.
2. Permissions are organized by module with a dot-notation code (e.g. "pos.sale.create").
3. user_roles is scoped per-branch: a user could be a cashier in branch A and a manager in branch B.
4. The `users` table is created in the next migration (003) — user_roles references it via FK.
*/

-- ============================================================
-- 1. roles
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  description   text
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_roles" ON roles;
CREATE POLICY "select_roles" ON roles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_roles" ON roles;
CREATE POLICY "insert_roles" ON roles FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_roles" ON roles;
CREATE POLICY "update_roles" ON roles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code          text UNIQUE NOT NULL,
  display_name  text NOT NULL,
  module        text NOT NULL
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_permissions" ON permissions;
CREATE POLICY "select_permissions" ON permissions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_permissions" ON permissions;
CREATE POLICY "insert_permissions" ON permissions FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- 3. role_permissions
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_role_permissions" ON role_permissions;
CREATE POLICY "select_role_permissions" ON role_permissions FOR SELECT
  TO authenticated USING (true);

-- ============================================================
-- 4. user_roles
-- NOTE: references users table which is created in migration 003.
-- We create the table here but the FK to users will be added in 003.
-- For now, user_id is a plain uuid that will match auth.users.id.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  user_id      uuid NOT NULL,
  role_id      uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  assigned_by  uuid,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id, branch_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_user_roles" ON user_roles;
CREATE POLICY "select_user_roles" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin', 'manager'))
    AND ur.branch_id = user_roles.branch_id
  ));

DROP POLICY IF EXISTS "insert_user_roles" ON user_roles;
CREATE POLICY "insert_user_roles" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    AND ur.branch_id = user_roles.branch_id
  ));

DROP POLICY IF EXISTS "update_user_roles" ON user_roles;
CREATE POLICY "update_user_roles" ON user_roles FOR UPDATE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    AND ur.branch_id = user_roles.branch_id
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    AND ur.branch_id = user_roles.branch_id
  ));

DROP POLICY IF EXISTS "delete_user_roles" ON user_roles;
CREATE POLICY "delete_user_roles" ON user_roles FOR DELETE
  TO authenticated USING (EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    AND ur.branch_id = user_roles.branch_id
  ));

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_branch ON user_roles(branch_id);
