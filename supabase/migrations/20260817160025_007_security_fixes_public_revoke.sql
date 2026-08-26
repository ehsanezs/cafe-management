/*
# Phase 1 Security Fix 2 — Revoke EXECUTE from PUBLIC on SECURITY DEFINER functions

## Purpose
PostgreSQL grants EXECUTE on functions to PUBLIC by default. The previous REVOKE from `anon` only
didn't work because PUBLIC still grants access. This migration:
1. REVOKE EXECUTE FROM PUBLIC on all three SECURITY DEFINER functions.
2. GRANT EXECUTE only to `authenticated` on log_audit and next_number (needed by the app).
3. Do NOT grant to anyone on handle_new_user (trigger-only, called by auth system internally).

## Security Changes
- `handle_new_user()`: No grants — only called by the auth.users trigger, never via RPC.
- `log_audit()`: GRANT EXECUTE TO authenticated only.
- `next_number()`: GRANT EXECUTE TO authenticated only.
*/

-- Revoke from PUBLIC (which includes anon) on all three functions
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION next_number(text, uuid) FROM PUBLIC;

-- Re-grant only to authenticated (not anon) on log_audit and next_number
GRANT EXECUTE ON FUNCTION log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION next_number(text, uuid) TO authenticated;

-- handle_new_user: no grant — it's a trigger function, called internally by the auth system
