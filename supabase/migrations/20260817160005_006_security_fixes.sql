/*
# Phase 1 Security Fix — Revoke anon EXECUTE on SECURITY DEFINER functions + fix search_path

## Purpose
Fix security advisor warnings from migration 004:
1. Revoke EXECUTE on `handle_new_user()` from anon and authenticated — it's a trigger function, should only be called by the auth.users trigger, never via RPC.
2. Revoke EXECUTE on `log_audit()` from anon — only authenticated should call it.
3. Revoke EXECUTE on `next_number()` from anon — only authenticated should call it.
4. Add `SET search_path = public` to `update_updated_at()` to fix mutable search_path warning.

## Security Changes
- `handle_new_user()`: REVOKE EXECUTE FROM anon, authenticated. This function is a trigger on auth.users and should never be called via REST/RPC.
- `log_audit()`: REVOKE EXECUTE FROM anon. Keep GRANT to authenticated (server-side functions call it).
- `next_number()`: REVOKE EXECUTE FROM anon. Keep GRANT to authenticated.
- `update_updated_at()`: Add `SET search_path = public` to fix mutable search_path warning.
*/

-- Revoke EXECUTE on handle_new_user from anon and authenticated (trigger-only function)
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM authenticated;

-- Revoke EXECUTE on log_audit from anon (keep for authenticated)
REVOKE EXECUTE ON FUNCTION log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, text, text) FROM anon;

-- Revoke EXECUTE on next_number from anon (keep for authenticated)
REVOKE EXECUTE ON FUNCTION next_number(text, uuid) FROM anon;

-- Fix mutable search_path on update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
