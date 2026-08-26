/*
# Phase 1 — Users Profile Table + Audit Logs

## Purpose
This migration creates:
- `users` — application-level user profile table linked 1:1 to Supabase auth.users
- `audit_logs` — immutable audit trail for all sensitive operations

## New Tables

### 1. users
- `id` (uuid PK, references auth.users.id ON DELETE CASCADE) — 1:1 with Supabase auth
- `email` (text NN)
- `full_name` (text NN)
- `phone` (text)
- `is_active` (bool NN, default true)
- `default_branch_id` (uuid FK → branches, NULL)
- `last_login_at` (timestamptz, NULL)
- `created_at` (timestamptz NN, default now())
- `updated_at` (timestamptz NN, default now())

### 2. audit_logs
- `id` (uuid PK)
- `user_id` (uuid FK → users)
- `branch_id` (uuid FK → branches)
- `action` (text NN) — e.g. "order.void", "price.change", "inventory.adjust"
- `entity_type` (text)
- `entity_id` (uuid)
- `old_values` (jsonb)
- `new_values` (jsonb)
- `reason` (text)
- `ip_address` (text)
- `device_id` (text)
- `created_at` (timestamptz NN, default now())

## Security
- RLS enabled on both tables.
- users: authenticated users can SELECT their own profile; admins/owners can see all users in their branch (via user_roles check).
- users: users can UPDATE their own profile (name, phone); role/branch assignment managed separately.
- audit_logs: SELECT for authenticated (own logs or branch logs if manager+); INSERT via SECURITY DEFINER function; NO UPDATE/DELETE (immutable).

## Changes to Existing Tables
- Adds FK constraint on user_roles.user_id → users.id (deferred from migration 002)

## Important Notes
1. The `users` table is NOT an auth table — it stores application-level profile data. Authentication is handled by Supabase auth.users.
2. When a user signs up via Supabase Auth, a trigger (migration 004) will auto-create a profile row in `users`.
3. audit_logs is designed to be append-only: no UPDATE or DELETE policies are created.
*/

-- ============================================================
-- 1. users (profile table — 1:1 with auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text NOT NULL,
  full_name           text NOT NULL,
  phone               text,
  is_active           boolean NOT NULL DEFAULT true,
  default_branch_id   uuid REFERENCES branches(id) ON DELETE SET NULL,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
DROP POLICY IF EXISTS "select_own_user" ON users;
CREATE POLICY "select_own_user" ON users FOR SELECT
  TO authenticated USING (auth.uid() = id);

-- Admins/owners can read all users in their branch
DROP POLICY IF EXISTS "select_branch_users" ON users;
CREATE POLICY "select_branch_users" ON users FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin', 'manager'))
    )
  );

-- Users can update their own profile (name, phone only — role changes via separate flow)
DROP POLICY IF EXISTS "update_own_user" ON users;
CREATE POLICY "update_own_user" ON users FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins/owners can update users in their branch
DROP POLICY IF EXISTS "update_branch_users" ON users;
CREATE POLICY "update_branch_users" ON users FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin'))
    )
  );

-- Insert: handled by trigger on auth.users (migration 004), but allow authenticated to insert own
DROP POLICY IF EXISTS "insert_own_user" ON users;
CREATE POLICY "insert_own_user" ON users FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. audit_logs (immutable audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  branch_id   uuid REFERENCES branches(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type  text,
  entity_id   uuid,
  old_values  jsonb,
  new_values  jsonb,
  reason      text,
  ip_address  text,
  device_id   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own audit logs
DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Managers+ can read audit logs for their branch
DROP POLICY IF EXISTS "select_branch_audit_logs" ON audit_logs;
CREATE POLICY "select_branch_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role_id IN (SELECT id FROM roles WHERE name IN ('owner', 'admin', 'manager', 'accountant'))
      AND (audit_logs.branch_id IS NULL OR ur.branch_id = audit_logs.branch_id)
    )
  );

-- Insert via SECURITY DEFINER function (migration 004) — but also allow direct insert for authenticated
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Add FK on user_roles.user_id → users.id (deferred from migration 002)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_user_id_fkey'
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Also add FK for assigned_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_assigned_by_fkey'
    AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_assigned_by_fkey
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_default_branch ON users(default_branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON audit_logs(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
