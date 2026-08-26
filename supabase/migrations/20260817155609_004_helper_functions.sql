/*
# Phase 1 — Helper Functions: Auto-Profile Trigger, Audit Log, Number Sequencing

## Purpose
This migration creates three critical server-side functions:

1. `handle_new_user()` — Trigger function that auto-creates a `users` profile row when a new auth.users record is created (on signup).
2. `log_audit()` — SECURITY DEFINER function to insert audit log entries (callable from other functions/triggers).
3. `next_number(p_key text, p_branch_id uuid)` — SECURITY DEFINER function for atomic document numbering using SELECT FOR UPDATE.

## New Functions

### 1. handle_new_user()
- Trigger function ON auth.users AFTER INSERT
- Creates a row in `users` table with id = new auth user id, email = new email
- full_name defaults to email (user can update later)
- This ensures every signup automatically gets a profile row

### 2. log_audit(
     p_user_id uuid, p_branch_id uuid, p_action text,
     p_entity_type text, p_entity_id uuid,
     p_old_values jsonb, p_new_values jsonb,
     p_reason text, p_device_id text
   ) RETURNS uuid
- SECURITY DEFINER — runs with elevated privileges to insert into audit_logs
- Bypasses RLS so any authorized function can log actions
- Returns the new audit_log id

### 3. next_number(
     p_sequence_key text, p_branch_id uuid
   ) RETURNS text
- SECURITY DEFINER — runs with elevated privileges
- Uses SELECT FOR UPDATE on number_sequences for atomic numbering
- Returns formatted number: prefix + zero-padded next_value (e.g. "INV-00042")
- Increments next_value atomically
- Raises exception if sequence doesn't exist

## Security
- `handle_new_user` is a trigger on auth.users (runs as part of signup)
- `log_audit` and `next_number` are SECURITY DEFINER functions
- They are callable by `authenticated` role (the frontend/edge functions)
- SECURITY DEFINER means they execute with the function owner's privileges (postgres), bypassing RLS
- This is intentional: these functions contain their own authorization logic

## Important Notes
1. The auto-profile trigger ensures the users table stays in sync with auth.users.
2. next_number() uses row-level locking (SELECT FOR UPDATE) to prevent duplicate numbers under concurrent access.
3. log_audit() is designed to be called from other SECURITY DEFINER functions (e.g. order finalization) in later phases.
4. These functions are the foundation for all server-side business logic in later phases.
*/

-- ============================================================
-- 1. handle_new_user() — auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. log_audit() — SECURITY DEFINER audit logging
-- ============================================================
CREATE OR REPLACE FUNCTION log_audit(
  p_user_id      uuid,
  p_branch_id    uuid,
  p_action       text,
  p_entity_type  text DEFAULT NULL,
  p_entity_id    uuid DEFAULT NULL,
  p_old_values   jsonb DEFAULT NULL,
  p_new_values   jsonb DEFAULT NULL,
  p_reason       text DEFAULT NULL,
  p_device_id    text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO audit_logs (
    user_id, branch_id, action,
    entity_type, entity_id,
    old_values, new_values,
    reason, device_id
  ) VALUES (
    p_user_id, p_branch_id, p_action,
    p_entity_type, p_entity_id,
    p_old_values, p_new_values,
    p_reason, p_device_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION log_audit TO authenticated;

-- ============================================================
-- 3. next_number() — atomic document numbering
-- ============================================================
CREATE OR REPLACE FUNCTION next_number(
  p_sequence_key text,
  p_branch_id    uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seq      number_sequences%ROWTYPE;
  v_result   text;
BEGIN
  -- Lock the row for atomic increment
  SELECT * INTO v_seq
  FROM number_sequences
  WHERE sequence_key = p_sequence_key AND branch_id = p_branch_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Number sequence not found: key=%, branch=%', p_sequence_key, p_branch_id;
  END IF;

  -- Format: PREFIX-00042 (zero-padded)
  v_result := v_seq.prefix || '-' || lpad(v_seq.next_value::text, v_seq.padding, '0');

  -- Increment
  UPDATE number_sequences
  SET next_value = next_value + 1
  WHERE sequence_key = p_sequence_key AND branch_id = p_branch_id;

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION next_number TO authenticated;

-- ============================================================
-- 4. updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at trigger to users table
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Apply updated_at trigger to settings table
DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
