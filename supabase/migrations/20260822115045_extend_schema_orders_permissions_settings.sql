/*
# Supplier Comparison Center - Extended Schema

## Overview
Adds order tracking, employee permissions, app settings, and comparison session cleanup support.

## New Tables

### orders
- `id` (uuid, PK)
- `client_id` (uuid, FK auth.users) - client who placed the order
- `client_name` (text) - snapshot of client name at order time
- `product_name` (text)
- `supplier_id` (uuid, FK suppliers)
- `supplier_real_name` (text) - real supplier name (admin only)
- `supplier_alias` (text) - alias shown to client
- `price` (numeric)
- `discount` (numeric)
- `final_price` (numeric)
- `quantity` (integer)
- `status` (text, default 'pending') - one of: pending, processing, completed, cancelled
- `created_at` (timestamptz)

### employee_permissions
- `id` (uuid, PK)
- `employee_id` (uuid, FK auth.users) - the employee
- `can_upload_suppliers` (boolean, default false)
- `can_update_suppliers` (boolean, default false)
- `can_view_orders` (boolean, default false)
- `can_manage_clients` (boolean, default false)
- `created_at` (timestamptz)

### app_settings
- `id` (int, PK, always 1 - singleton)
- `cleanup_start_time` (text, default '00:00') - cleanup window start
- `cleanup_end_time` (text, default '02:00') - cleanup window end
- `updated_by` (uuid, FK auth.users)
- `updated_at` (timestamptz)

### comparison_sessions
- `id` (uuid, PK)
- `client_id` (uuid, FK auth.users)
- `file_name` (text) - uploaded shortage file name
- `item_count` (integer)
- `results` (jsonb) - comparison results JSON
- `created_at` (timestamptz)

## Modified Tables
- `cart_items`: added `status` column (text, default 'active') to distinguish cart items from ordered items

## Functions
- `is_admin()` - already exists
- `is_employee()` - SECURITY DEFINER, checks if current user has employee role
- `get_employee_permissions(emp_id uuid)` - SECURITY DEFINER, returns permission row for an employee

## Security (RLS)

### orders
- SELECT: admin sees all; clients see only their own; employees with can_view_orders see all
- INSERT: clients insert their own; admin can insert
- UPDATE: admin only (for status changes)
- DELETE: admin only

### employee_permissions
- SELECT: admin sees all; employee sees own
- INSERT/UPDATE/DELETE: admin only

### app_settings
- SELECT: all authenticated can read (needed for client welcome page)
- UPDATE: admin only

### comparison_sessions
- SELECT: admin sees all; client sees own
- INSERT: client inserts own
- DELETE: admin can delete any; client can delete own

### cart_items
- Added UPDATE policy already exists; no change needed for status column

## Seeded Data
- Default app_settings row with cleanup window 00:00-02:00
*/

-- ============ NEW TABLES ============

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text NOT NULL DEFAULT '',
  product_name text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_real_name text NOT NULL DEFAULT '',
  supplier_alias text NOT NULL DEFAULT '',
  price numeric(12,2) DEFAULT 0,
  discount numeric(5,2) DEFAULT 0,
  final_price numeric(12,2) DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS employee_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  can_upload_suppliers boolean NOT NULL DEFAULT false,
  can_update_suppliers boolean NOT NULL DEFAULT false,
  can_view_orders boolean NOT NULL DEFAULT false,
  can_manage_clients boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1,
  cleanup_start_time text NOT NULL DEFAULT '00:00',
  cleanup_end_time text NOT NULL DEFAULT '02:00',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT singleton_check CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS comparison_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  item_count integer DEFAULT 0,
  results jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============ ADD STATUS TO CART_ITEMS ============

ALTER TABLE cart_items ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comparison_sessions_client_id ON comparison_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_status ON cart_items(status);

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION is_employee()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'employee' AND profiles.enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION get_employee_permissions(emp_id uuid)
RETURNS employee_permissions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM employee_permissions WHERE employee_id = emp_id;
$$;

-- ============ RLS ============

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparison_sessions ENABLE ROW LEVEL SECURITY;

-- orders policies
DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = client_id
    OR is_admin()
    OR (is_employee() AND EXISTS (
      SELECT 1 FROM employee_permissions ep
      WHERE ep.employee_id = auth.uid() AND ep.can_view_orders = true
    ))
  );

DROP POLICY IF EXISTS "insert_orders" ON orders;
CREATE POLICY "insert_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = client_id OR is_admin());

DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "delete_orders" ON orders;
CREATE POLICY "delete_orders" ON orders FOR DELETE
  TO authenticated USING (is_admin());

-- employee_permissions policies
DROP POLICY IF EXISTS "select_employee_permissions" ON employee_permissions;
CREATE POLICY "select_employee_permissions" ON employee_permissions FOR SELECT
  TO authenticated USING (auth.uid() = employee_id OR is_admin());

DROP POLICY IF EXISTS "admin_insert_employee_permissions" ON employee_permissions;
CREATE POLICY "admin_insert_employee_permissions" ON employee_permissions FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_employee_permissions" ON employee_permissions;
CREATE POLICY "admin_update_employee_permissions" ON employee_permissions FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_employee_permissions" ON employee_permissions;
CREATE POLICY "admin_delete_employee_permissions" ON employee_permissions FOR DELETE
  TO authenticated USING (is_admin());

-- app_settings policies
DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
CREATE POLICY "read_app_settings" ON app_settings FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_app_settings" ON app_settings;
CREATE POLICY "admin_update_app_settings" ON app_settings FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- comparison_sessions policies
DROP POLICY IF EXISTS "select_comparison_sessions" ON comparison_sessions;
CREATE POLICY "select_comparison_sessions" ON comparison_sessions FOR SELECT
  TO authenticated USING (auth.uid() = client_id OR is_admin());

DROP POLICY IF EXISTS "insert_comparison_sessions" ON comparison_sessions;
CREATE POLICY "insert_comparison_sessions" ON comparison_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "delete_comparison_sessions" ON comparison_sessions;
CREATE POLICY "delete_comparison_sessions" ON comparison_sessions FOR DELETE
  TO authenticated USING (auth.uid() = client_id OR is_admin());

-- ============ SEED DATA ============

INSERT INTO app_settings (id, cleanup_start_time, cleanup_end_time)
VALUES (1, '00:00', '02:00')
ON CONFLICT (id) DO NOTHING;
