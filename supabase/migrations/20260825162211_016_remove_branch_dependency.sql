/*
# Remove branch dependency — single-branch operation

## Summary
The system no longer uses branches. All branch_id columns are made nullable,
the next_number function works with NULL branch_id, and number_sequences
uses a single default sequence set per key.

## Changes
- orders.branch_id → nullable
- restaurant_tables.branch_id → nullable
- stock_movements.branch_id → nullable
- inventory_balances.branch_id → nullable
- purchase_orders.branch_id → nullable
- number_sequences.branch_id → nullable
- next_number function: accepts NULL p_branch_id, matches sequences with branch_id IS NULL
- Seed default sequences with branch_id = NULL for all keys
*/

-- Make branch_id nullable on all tables
DO $$ BEGIN
  ALTER TABLE orders ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE restaurant_tables ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE stock_movements ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE inventory_balances ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE purchase_orders ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE number_sequences ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Replace next_number function to support NULL branch_id
CREATE OR REPLACE FUNCTION public.next_number(p_sequence_key text, p_branch_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seq    number_sequences%ROWTYPE;
  v_result text;
BEGIN
  -- Try to find a sequence with the given branch_id first, then fall back to NULL branch
  SELECT * INTO v_seq
  FROM number_sequences
  WHERE sequence_key = p_sequence_key
    AND (p_branch_id IS NOT NULL AND branch_id = p_branch_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT * INTO v_seq
    FROM number_sequences
    WHERE sequence_key = p_sequence_key AND branch_id IS NULL
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Number sequence not found: key=%', p_sequence_key;
  END IF;

  v_result := v_seq.prefix || '-' || lpad(v_seq.next_value::text, v_seq.padding, '0');

  UPDATE number_sequences
  SET next_value = next_value + 1
  WHERE id = v_seq.id;

  RETURN v_result;
END;
$function$;

-- Seed default sequences with NULL branch_id (if not already present)
INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'order', NULL, 'INV', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'order' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'purchase_order', NULL, 'PO', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'purchase_order' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'purchase', NULL, 'PO', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'purchase' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'receipt', NULL, 'GRN', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'receipt' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'journal', NULL, 'JV', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'journal' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'waste', NULL, 'WST', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'waste' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'adjustment', NULL, 'ADJ', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'adjustment' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'refund', NULL, 'REF', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'refund' AND branch_id IS NULL);

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'cash_register', NULL, 'CR', 1, 5
WHERE NOT EXISTS (SELECT 1 FROM number_sequences WHERE sequence_key = 'cash_register' AND branch_id IS NULL);
