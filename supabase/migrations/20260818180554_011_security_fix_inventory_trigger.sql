/*
# Phase 3 Security Fix — Revoke PUBLIC EXECUTE on update_inventory_balance

## Purpose
The trigger function update_inventory_balance() was granted EXECUTE to PUBLIC by default.
This migration revokes PUBLIC access so anon users cannot call it via REST.
The function is a trigger — it should only fire on stock_movements INSERT, never via RPC.
*/

REVOKE EXECUTE ON FUNCTION update_inventory_balance() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION update_inventory_balance() FROM anon;
REVOKE EXECUTE ON FUNCTION update_inventory_balance() FROM authenticated;
