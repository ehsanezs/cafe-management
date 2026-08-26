/*
# Phase 5 — Accounting & Cash Management

## Purpose
Creates the financial tracking system:
- `expense_categories` — categorization of expenses (rent, utilities, salaries, supplies, etc.)
- `expenses` — recorded expenses with category, amount, payment method, status
- `cash_registers` — cash drawer sessions per branch (opening/closing balances)
- `transactions` — general ledger of all financial movements (sales, expenses, adjustments)

## New Tables

### 1. expense_categories
- id, name, color, is_system (built-in categories cannot be deleted)

### 2. expenses
- id, branch_id, category_id, amount, description, expense_date, payment_method, status, created_by, created_at

### 3. cash_registers
- id, branch_id, session_number, opened_by, opened_at, opening_balance, closed_by, closed_at, closing_balance, status (open | closed), notes

### 4. transactions
- id, branch_id, type (sale | expense | adjustment | transfer | refund), amount, direction (in | out), reference_type, reference_id, description, created_at

## Security
- RLS enabled on all tables, authenticated CRUD

## Important Notes
1. Transactions are an immutable ledger — INSERT only, no UPDATE/DELETE.
2. Cash register sessions track opening/closing balances for reconciliation.
3. Expenses auto-create a transaction entry via application layer.
4. Sales payments auto-create transactions via application layer (future enhancement).
*/

-- ============================================================
-- 1. expense_categories
-- ============================================================
CREATE TABLE IF NOT EXISTS expense_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  color       text DEFAULT '#6b7280',
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_expense_categories" ON expense_categories;
CREATE POLICY "select_expense_categories" ON expense_categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_expense_categories" ON expense_categories;
CREATE POLICY "insert_expense_categories" ON expense_categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_expense_categories" ON expense_categories;
CREATE POLICY "update_expense_categories" ON expense_categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_expense_categories" ON expense_categories;
CREATE POLICY "delete_expense_categories" ON expense_categories FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- 2. expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  category_id     uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  amount          numeric(18,2) NOT NULL,
  description      text,
  expense_date    timestamptz NOT NULL DEFAULT now(),
  payment_method  text NOT NULL DEFAULT 'cash',
  status          text NOT NULL DEFAULT 'paid',
  created_by      uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);

-- ============================================================
-- 3. cash_registers
-- ============================================================
CREATE TABLE IF NOT EXISTS cash_registers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  session_number  text NOT NULL,
  opened_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  opening_balance numeric(18,2) NOT NULL DEFAULT 0,
  closed_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at       timestamptz,
  closing_balance numeric(18,2),
  status          text NOT NULL DEFAULT 'open',
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_cash_registers" ON cash_registers;
CREATE POLICY "select_cash_registers" ON cash_registers FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_cash_registers" ON cash_registers;
CREATE POLICY "insert_cash_registers" ON cash_registers FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_cash_registers" ON cash_registers;
CREATE POLICY "update_cash_registers" ON cash_registers FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_cash_registers" ON cash_registers;
CREATE POLICY "delete_cash_registers" ON cash_registers FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_cash_reg_branch ON cash_registers(branch_id);
CREATE INDEX IF NOT EXISTS idx_cash_reg_status ON cash_registers(status);

-- ============================================================
-- 4. transactions (immutable ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id       uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  type            text NOT NULL,
  direction       text NOT NULL,
  amount          numeric(18,2) NOT NULL,
  reference_type  text,
  reference_id    uuid,
  description      text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_transactions" ON transactions;
CREATE POLICY "select_transactions" ON transactions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_transactions" ON transactions;
CREATE POLICY "insert_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (true);

-- No UPDATE or DELETE — immutable ledger

CREATE INDEX IF NOT EXISTS idx_trans_branch ON transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_trans_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_trans_date ON transactions(created_at);

-- ============================================================
-- Seed: number sequences for cash register sessions
-- ============================================================
INSERT INTO number_sequences (branch_id, sequence_key, prefix, next_value, padding)
SELECT b.id, 'cash_register', 'CR-', 1, 5
FROM branches b
WHERE NOT EXISTS (
  SELECT 1 FROM number_sequences ns WHERE ns.branch_id = b.id AND ns.sequence_key = 'cash_register'
);

-- ============================================================
-- Seed: system expense categories
-- ============================================================
INSERT INTO expense_categories (name, color, is_system)
SELECT * FROM (VALUES
  ('اجاره', '#6366f1', true),
  ('حقوق و دستمزد', '#10b981', true),
  ('آب و برق و گاز', '#3b82f6', true),
  ('تأمین کالا', '#f59e0b', true),
  ('نگهداری و تعمیرات', '#8b5cf6', true),
  ('تبلیغات و بازاریابی', '#ec4899', true),
  ('حمل و نقل', '#14b8a6', true),
  ('متفرقه', '#6b7280', true)
) AS v(name, color, is_system)
WHERE NOT EXISTS (SELECT 1 FROM expense_categories WHERE is_system = true);
