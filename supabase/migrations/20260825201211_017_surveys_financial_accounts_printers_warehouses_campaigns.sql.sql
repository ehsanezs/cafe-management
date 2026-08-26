-- ============================================================
-- 017: Surveys, Financial Accounts, Printers, Warehouses, Campaigns, Product Images, Customer Preferences
-- ============================================================

-- ============================================================
-- 1. Surveys & Feedback
-- ============================================================
CREATE TABLE IF NOT EXISTS survey_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'rating' CHECK (question_type IN ('rating', 'text', 'choice', 'yes_no')),
  choices jsonb,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_phone text,
  overall_rating int CHECK (overall_rating >= 1 AND overall_rating <= 5),
  responses jsonb NOT NULL DEFAULT '{}',
  feedback_text text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  device_fingerprint text,
  ip_address inet,
  is_verified boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS survey_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  customer_phone text,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_order ON survey_responses(order_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_rating ON survey_responses(overall_rating);
CREATE INDEX IF NOT EXISTS idx_survey_links_token ON survey_links(token);

-- ============================================================
-- 2. Financial Accounts (bank, cash, petty cash)
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('bank', 'cash', 'petty_cash')),
  bank_name text,
  bank_branch text,
  account_number text,
  card_number text,
  iban text,
  opening_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Account tree (chart of accounts)
CREATE TABLE IF NOT EXISTS chart_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES chart_accounts(id) ON DELETE SET NULL,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  level int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Journal entries
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL,
  entry_date timestamptz NOT NULL DEFAULT now(),
  description text,
  debit_account_id uuid REFERENCES chart_accounts(id),
  credit_account_id uuid REFERENCES chart_accounts(id),
  amount numeric NOT NULL DEFAULT 0,
  reference_type text,
  reference_id uuid,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Budget
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  period_type text NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue_budget numeric NOT NULL DEFAULT 0,
  expense_budget numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_chart_accounts_parent ON chart_accounts(parent_id);

-- ============================================================
-- 3. Printers
-- ============================================================
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  printer_type text NOT NULL DEFAULT 'thermal' CHECK (printer_type IN ('thermal', 'kitchen', 'label', 'regular')),
  connection_type text NOT NULL DEFAULT 'network' CHECK (connection_type IN ('network', 'usb', 'bluetooth')),
  ip_address text,
  port int DEFAULT 9100,
  mac_address text,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  paper_width int NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. Warehouses (multi-warehouse support)
-- ============================================================
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add warehouse_id to inventory_balances and stock_movements
ALTER TABLE inventory_balances ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;

-- ============================================================
-- 5. Marketing Campaigns & SMS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'discount' CHECK (campaign_type IN ('discount', 'credit', 'sms', 'loyalty')),
  target_group_id uuid REFERENCES customer_groups(id) ON DELETE SET NULL,
  discount_percent numeric DEFAULT 0,
  credit_amount numeric DEFAULT 0,
  sms_message text,
  start_date timestamptz,
  end_date timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  sent_count int NOT NULL DEFAULT 0,
  response_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sms_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_campaign ON sms_logs(campaign_id);

-- ============================================================
-- 6. Product Images (multiple images per product)
-- ============================================================
CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ============================================================
-- 7. Customer Preferences (taste tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  preference_type text NOT NULL CHECK (preference_type IN ('favorite', 'dislike', 'allergy', 'note')),
  preference_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_preferences_customer ON customer_preferences(customer_id);

-- ============================================================
-- 8. Product Day Availability
-- ============================================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS available_days text[] DEFAULT ARRAY['sat','sun','mon','tue','wed','thu','fri'];
ALTER TABLE products ADD COLUMN IF NOT EXISTS show_as_out_of_stock boolean NOT NULL DEFAULT false;

-- ============================================================
-- 9. AI Analysis Cache (for AI-powered insights)
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_analysis_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_ai_analysis_type ON ai_analysis_cache(analysis_type, entity_type);

-- ============================================================
-- 10. Settings extensions (branding, dark mode, social media)
-- ============================================================
ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#f59e0b';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS dark_mode_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_instagram text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_telegram text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS social_whatsapp text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '{"sat":"09:00-22:00","sun":"09:00-22:00","mon":"09:00-22:00","tue":"09:00-22:00","wed":"09:00-22:00","thu":"09:00-22:00","fri":"09:00-22:00"}';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS brand_story text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS address text;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Survey questions
ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_survey_questions" ON survey_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_survey_questions" ON survey_questions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_survey_questions" ON survey_questions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_survey_questions" ON survey_questions FOR DELETE TO authenticated USING (true);

-- Survey responses
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_survey_responses" ON survey_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_survey_responses" ON survey_responses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_survey_responses" ON survey_responses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_survey_responses" ON survey_responses FOR DELETE TO authenticated USING (true);

-- Survey links
ALTER TABLE survey_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_survey_links" ON survey_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_survey_links" ON survey_links FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_survey_links" ON survey_links FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_survey_links" ON survey_links FOR DELETE TO authenticated USING (true);

-- Financial accounts
ALTER TABLE financial_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_financial_accounts" ON financial_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_financial_accounts" ON financial_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_financial_accounts" ON financial_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_financial_accounts" ON financial_accounts FOR DELETE TO authenticated USING (true);

-- Chart accounts
ALTER TABLE chart_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_chart_accounts" ON chart_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_chart_accounts" ON chart_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_chart_accounts" ON chart_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_chart_accounts" ON chart_accounts FOR DELETE TO authenticated USING (true);

-- Journal entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_journal_entries" ON journal_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_journal_entries" ON journal_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_journal_entries" ON journal_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_journal_entries" ON journal_entries FOR DELETE TO authenticated USING (true);

-- Budgets
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_budgets" ON budgets FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_budgets" ON budgets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_budgets" ON budgets FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_budgets" ON budgets FOR DELETE TO authenticated USING (true);

-- Printers
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_printers" ON printers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_printers" ON printers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_printers" ON printers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_printers" ON printers FOR DELETE TO authenticated USING (true);

-- Warehouses
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_warehouses" ON warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_warehouses" ON warehouses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_warehouses" ON warehouses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_warehouses" ON warehouses FOR DELETE TO authenticated USING (true);

-- Campaigns
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_campaigns" ON campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_campaigns" ON campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_campaigns" ON campaigns FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_campaigns" ON campaigns FOR DELETE TO authenticated USING (true);

-- SMS logs
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_sms_logs" ON sms_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_sms_logs" ON sms_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_sms_logs" ON sms_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_sms_logs" ON sms_logs FOR DELETE TO authenticated USING (true);

-- Product images
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_product_images" ON product_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_product_images" ON product_images FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_product_images" ON product_images FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_product_images" ON product_images FOR DELETE TO authenticated USING (true);

-- Customer preferences
ALTER TABLE customer_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_preferences" ON customer_preferences FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_customer_preferences" ON customer_preferences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_customer_preferences" ON customer_preferences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_customer_preferences" ON customer_preferences FOR DELETE TO authenticated USING (true);

-- AI analysis cache
ALTER TABLE ai_analysis_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_ai_analysis_cache" ON ai_analysis_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_ai_analysis_cache" ON ai_analysis_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_ai_analysis_cache" ON ai_analysis_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_ai_analysis_cache" ON ai_analysis_cache FOR DELETE TO authenticated USING (true);

-- Seed default survey questions
INSERT INTO survey_questions (question_text, question_type, display_order) VALUES
  ('کیفیت غذا را如何评价 می‌کنید؟', 'rating', 1),
  ('سرعت سرو چطور بود؟', 'rating', 2),
  ('برخورد پرسنل چطور بود؟', 'rating', 3),
  ('تمیزی محیط چطور بود؟', 'rating', 4),
  ('نظر کلی شما چیست؟', 'text', 5),
  ('آیا ما را به دوستانتان پیشنهاد می‌دهید؟', 'yes_no', 6)
ON CONFLICT DO NOTHING;

-- Seed default warehouses
INSERT INTO warehouses (name, code) VALUES ('انبار اصلی', 'WH-01') ON CONFLICT (code) DO NOTHING;

-- Seed default financial accounts
INSERT INTO financial_accounts (name, account_type, current_balance) VALUES
  ('صندوق فروش', 'cash', 0),
  ('تنخواه', 'petty_cash', 0)
ON CONFLICT DO NOTHING;

-- Seed default chart accounts
INSERT INTO chart_accounts (code, name, account_type, level) VALUES
  ('1000', 'دارایی‌ها', 'asset', 1),
  ('1100', 'وجه نقد', 'asset', 2),
  ('1200', 'بانک', 'asset', 2),
  ('1300', 'موجودی انبار', 'asset', 2),
  ('1400', 'حساب‌های دریافتنی', 'asset', 2),
  ('2000', 'بدهی‌ها', 'liability', 1),
  ('2100', 'حساب‌های پرداختنی', 'liability', 2),
  ('2200', 'هزینه‌های پرداختنی', 'liability', 2),
  ('3000', 'سرمایه', 'equity', 1),
  ('4000', 'درآمد فروش', 'revenue', 1),
  ('4100', 'درآمد حضوری', 'revenue', 2),
  ('4200', 'درآمد آنلاین', 'revenue', 2),
  ('4300', 'درآمد دلیوری', 'revenue', 2),
  ('5000', 'هزینه‌ها', 'expense', 1),
  ('5100', 'هزینه مواد اولیه', 'expense', 2),
  ('5200', 'هزینه پرسنلی', 'expense', 2),
  ('5300', 'هزینه اجاره', 'expense', 2),
  ('5400', 'هزینه آب و برق و گاز', 'expense', 2),
  ('5500', 'هزینه‌های متفرقه', 'expense', 2)
ON CONFLICT (code) DO NOTHING;