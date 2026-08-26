/*
# Phase 1 — Seed Data: Roles, Permissions, Default Branch, Settings, Number Sequences

## Purpose
This migration populates the foundational tables with default data:

1. **8 Roles** — owner, admin, manager, cashier, inventory_manager, kitchen, accountant, viewer
2. **Permissions** — ~40 granular permissions across 7 modules
3. **Role-Permission mappings** — each role gets its appropriate permissions
4. **Default branch** — "شعبه اصلی" (main branch) with code "MAIN"
5. **Default settings** — global settings row (branch_id = NULL)
6. **Number sequences** — 7 sequences for the default branch

## Seeded Data

### Roles (8):
| Role | Display Name (Persian) |
|---|---|
| owner | صاحب رستوران |
| admin | مدیر سیستم |
| manager | مدیر رستوران |
| cashier | صندوق‌دار |
| inventory_manager | مسئول انبار |
| kitchen | آشپزخانه |
| accountant | حسابدار |
| viewer | مشاهده‌گر |

### Permissions (~40):
- pos: sale.create, sale.void, sale.refund, sale.discount, kitchen.view, tables.manage
- inventory: view, adjust, transfer, count, waste.create, waste.view
- products: view, create, edit, recipe.manage
- purchase: view, create, confirm, payment
- accounting: view, journal.create, journal.void, cash.manage, expense.create, expense.view
- crm: view, create, edit, loyalty.manage, campaign.manage
- reports: view, export
- settings: view, edit
- users: view, create, edit, roles.manage

### Role-Permission Matrix:
- **owner**: ALL permissions (full access)
- **admin**: ALL except users.roles.manage (can manage users but not reassign owner role)
- **manager**: Most permissions except settings.edit, users.create, users.roles.manage
- **cashier**: pos.* + products.view + reports.view (limited)
- **inventory_manager**: inventory.* + purchase.* + products.view + reports.view
- **kitchen**: kitchen.view + products.view + orders.kitchen
- **accountant**: accounting.* + reports.view + pos.view
- **viewer**: reports.view + products.view + dashboard.view

### Default Branch:
- code: "MAIN", name: "شعبه اصلی"

### Number Sequences (for default branch):
| Key | Prefix |
|---|---|
| order | INV |
| purchase | PO |
| receipt | GRN |
| journal | JV |
| waste | WST |
| adjustment | ADJ |
| refund | REF |

## Important Notes
1. This migration is idempotent — uses ON CONFLICT DO NOTHING for all inserts.
2. The first user who signs up will need to be assigned the 'owner' role manually (or via a setup screen).
3. Number sequences start at 1 with 5-digit padding.
*/

-- ============================================================
-- 1. Seed Roles
-- ============================================================
INSERT INTO roles (name, display_name, description) VALUES
  ('owner',            'صاحب رستوران',   'دسترسی کامل به تمام بخش‌های سیستم'),
  ('admin',            'مدیر سیستم',      'مدیریت کامل به جز تغییر نقش صاحب'),
  ('manager',          'مدیر رستوران',    'مدیریت عملیات روزانه رستوران'),
  ('cashier',          'صندوق‌دار',       'ثبت فروش و مدیریت صندوق'),
  ('inventory_manager','مسئول انبار',     'مدیریت انبار و خرید'),
  ('kitchen',          'آشپزخانه',        'مشاهده سفارشات آشپزخانه'),
  ('accountant',       'حسابدار',         'مدیریت حسابداری و گزارش‌های مالی'),
  ('viewer',           'مشاهده‌گر',       'فقط مشاهده گزارش‌ها و داشبورد')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. Seed Permissions
-- ============================================================
INSERT INTO permissions (code, display_name, module) VALUES
  -- POS
  ('pos.sale.create',      'ثبت فروش',              'pos'),
  ('pos.sale.void',        'ابطال فاکتور',          'pos'),
  ('pos.sale.refund',      'برگشت فروش',            'pos'),
  ('pos.sale.discount',    'اعطای تخفیف',           'pos'),
  ('pos.kitchen.view',     'مشاهده آشپزخانه',       'pos'),
  ('pos.tables.manage',    'مدیریت میزها',          'pos'),
  -- Inventory
  ('inventory.view',       'مشاهده انبار',          'inventory'),
  ('inventory.adjust',     'اصلاح موجودی',          'inventory'),
  ('inventory.transfer',   'انتقال بین انبارها',    'inventory'),
  ('inventory.count',      'شمارش انبار',           'inventory'),
  ('inventory.waste.create','ثبت ضایعات',           'inventory'),
  ('inventory.waste.view', 'مشاهده ضایعات',         'inventory'),
  -- Products
  ('products.view',        'مشاهده محصولات',        'products'),
  ('products.create',      'ایجاد محصول',           'products'),
  ('products.edit',        'ویرایش محصول',          'products'),
  ('products.recipe.manage','مدیریت رسپی',           'products'),
  -- Purchase
  ('purchase.view',        'مشاهده خرید',           'purchase'),
  ('purchase.create',      'ثبت سفارش خرید',        'purchase'),
  ('purchase.confirm',     'تأیید رسید کالا',       'purchase'),
  ('purchase.payment',    'پرداخت به تأمین‌کننده',  'purchase'),
  -- Accounting
  ('accounting.view',     'مشاهده حسابداری',        'accounting'),
  ('accounting.journal.create','ثبت سند',           'accounting'),
  ('accounting.journal.void','ابطال سند',            'accounting'),
  ('accounting.cash.manage','مدیریت صندوق',         'accounting'),
  ('accounting.expense.create','ثبت هزینه',         'accounting'),
  ('accounting.expense.view','مشاهده هزینه',        'accounting'),
  -- CRM
  ('crm.view',             'مشاهده مشتریان',         'crm'),
  ('crm.create',          'ایجاد مشتری',            'crm'),
  ('crm.edit',            'ویرایش مشتری',           'crm'),
  ('crm.loyalty.manage',  'مدیریت باشگاه مشتریان',  'crm'),
  ('crm.campaign.manage', 'مدیریت کمپین‌ها',        'crm'),
  -- Reports
  ('reports.view',         'مشاهده گزارش‌ها',       'reports'),
  ('reports.export',       'خروجی گزارش',           'reports'),
  -- Settings
  ('settings.view',        'مشاهده تنظیمات',         'settings'),
  ('settings.edit',        'ویرایش تنظیمات',         'settings'),
  -- Users
  ('users.view',           'مشاهده کاربران',         'users'),
  ('users.create',         'ایجاد کاربر',           'users'),
  ('users.edit',           'ویرایش کاربر',          'users'),
  ('users.roles.manage',   'مدیریت نقش‌ها',         'users'),
  -- Dashboard
  ('dashboard.view',        'مشاهده داشبورد',        'dashboard')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Seed Role-Permission Mappings
-- ============================================================

-- owner: ALL permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- admin: ALL except users.roles.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin' AND p.code != 'users.roles.manage'
ON CONFLICT DO NOTHING;

-- manager: most except settings.edit, users.create, users.roles.manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
  AND p.code NOT IN ('settings.edit', 'users.create', 'users.roles.manage')
ON CONFLICT DO NOTHING;

-- cashier: pos.* + products.view + reports.view + dashboard.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'cashier'
  AND (p.module = 'pos' OR p.code IN ('products.view', 'reports.view', 'dashboard.view'))
ON CONFLICT DO NOTHING;

-- inventory_manager: inventory.* + purchase.* + products.view + reports.view + dashboard.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'inventory_manager'
  AND (p.module IN ('inventory', 'purchase') OR p.code IN ('products.view', 'reports.view', 'dashboard.view'))
ON CONFLICT DO NOTHING;

-- kitchen: pos.kitchen.view + products.view + dashboard.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'kitchen'
  AND p.code IN ('pos.kitchen.view', 'products.view', 'dashboard.view')
ON CONFLICT DO NOTHING;

-- accountant: accounting.* + reports.view + dashboard.view + pos.sale (read)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'accountant'
  AND (p.module = 'accounting' OR p.code IN ('reports.view', 'dashboard.view'))
ON CONFLICT DO NOTHING;

-- viewer: reports.view + products.view + dashboard.view
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'viewer'
  AND p.code IN ('reports.view', 'products.view', 'dashboard.view')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. Default Branch
-- ============================================================
INSERT INTO branches (code, name, address, phone, is_active)
VALUES ('MAIN', 'شعبه اصلی', NULL, NULL, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 5. Default Global Settings (branch_id = NULL)
-- ============================================================
INSERT INTO settings (branch_id, restaurant_name, currency, tax_enabled, default_tax_rate, cost_method, target_food_cost_percent, variance_threshold_percent, void_policy)
VALUES (
  NULL,
  'کافه‌رستوران',
  'toman',
  false,
  0,
  'weighted_average',
  30,
  5,
  '{"allowed_before_payment": true, "time_limit_minutes": null, "until_end_of_shift": true, "requires_manager_approval": false, "requires_owner_approval": false}'::jsonb
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. Number Sequences for Default Branch
-- ============================================================
INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'order', id, 'INV', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'purchase', id, 'PO', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'receipt', id, 'GRN', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'journal', id, 'JV', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'waste', id, 'WST', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'adjustment', id, 'ADJ', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;

INSERT INTO number_sequences (sequence_key, branch_id, prefix, next_value, padding)
SELECT 'refund', id, 'REF', 1, 5 FROM branches WHERE code = 'MAIN'
ON CONFLICT (sequence_key, branch_id) DO NOTHING;
