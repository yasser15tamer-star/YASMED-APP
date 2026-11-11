/*
# Supplier Comparison Center - Database Schema

Creates the complete database schema for the Supplier Comparison Center app: user profiles with roles, suppliers with real/alias names, supplier products, and a shopping cart for clients.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'مستخدم جديد',
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'employee', 'client')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  real_name text NOT NULL,
  alias_name text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supplier_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  price numeric(12,2) DEFAULT 0,
  discount numeric(5,2) DEFAULT 0,
  final_price numeric(12,2) DEFAULT 0,
  quantity integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  supplier_alias text NOT NULL,
  price numeric(12,2) DEFAULT 0,
  discount numeric(5,2) DEFAULT 0,
  final_price numeric(12,2) DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- ============ INDEXES ============

CREATE INDEX IF NOT EXISTS idx_supplier_products_supplier_id ON supplier_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_client_id ON cart_items(client_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin' AND profiles.enabled = true
  );
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, enabled)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'client'),
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============ VIEWS ============

CREATE OR REPLACE VIEW supplier_aliases AS
SELECT id, alias_name, created_at FROM suppliers;

CREATE OR REPLACE VIEW client_products AS
SELECT
  sp.id,
  sp.supplier_id,
  sp.product_name,
  sp.price,
  sp.discount,
  sp.final_price,
  sp.quantity,
  s.alias_name AS supplier_alias
FROM supplier_products sp
INNER JOIN suppliers s ON s.id = sp.supplier_id;

-- ============ RLS ============

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- profiles
DROP POLICY IF EXISTS "select_own_or_all_profiles" ON profiles;
CREATE POLICY "select_own_or_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "update_own_or_admin_profiles" ON profiles;
CREATE POLICY "update_own_or_admin_profiles" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

-- suppliers (admin only)
DROP POLICY IF EXISTS "admin_select_suppliers" ON suppliers;
CREATE POLICY "admin_select_suppliers" ON suppliers FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_suppliers" ON suppliers;
CREATE POLICY "admin_insert_suppliers" ON suppliers FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_suppliers" ON suppliers;
CREATE POLICY "admin_update_suppliers" ON suppliers FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_suppliers" ON suppliers;
CREATE POLICY "admin_delete_suppliers" ON suppliers FOR DELETE
  TO authenticated USING (is_admin());

-- supplier_products
DROP POLICY IF EXISTS "read_supplier_products" ON supplier_products;
CREATE POLICY "read_supplier_products" ON supplier_products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_supplier_products" ON supplier_products;
CREATE POLICY "admin_insert_supplier_products" ON supplier_products FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_supplier_products" ON supplier_products;
CREATE POLICY "admin_update_supplier_products" ON supplier_products FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_supplier_products" ON supplier_products;
CREATE POLICY "admin_delete_supplier_products" ON supplier_products FOR DELETE
  TO authenticated USING (is_admin());

-- cart_items (client owns their cart)
DROP POLICY IF EXISTS "select_own_cart" ON cart_items;
CREATE POLICY "select_own_cart" ON cart_items FOR SELECT
  TO authenticated USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "insert_own_cart" ON cart_items;
CREATE POLICY "insert_own_cart" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "update_own_cart" ON cart_items;
CREATE POLICY "update_own_cart" ON cart_items FOR UPDATE
  TO authenticated USING (auth.uid() = client_id) WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "delete_own_cart" ON cart_items;
CREATE POLICY "delete_own_cart" ON cart_items FOR DELETE
  TO authenticated USING (auth.uid() = client_id);

-- ============ GRANTS ON VIEWS ============

GRANT SELECT ON supplier_aliases TO authenticated;
GRANT SELECT ON client_products TO authenticated;

-- ============ SEED ADMIN ACCOUNT ============

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, aud, role, instance_id)
SELECT
  gen_random_uuid(),
  'admin@center.com',
  crypt('Admin@2024', gen_salt('bf')),
  now(),
  '{"role":"admin"}'::jsonb,
  '{"full_name":"المدير العام"}'::jsonb,
  now(),
  now(),
  'authenticated',
  'authenticated',
  '00000000-0000-0000-0000-000000000000'
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@center.com');

INSERT INTO profiles (id, full_name, role, enabled)
SELECT
  au.id,
  'المدير العام',
  'admin',
  true
FROM auth.users au
WHERE au.email = 'admin@center.com'
AND NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = au.id)
ON CONFLICT (id) DO UPDATE SET
  role = 'admin',
  full_name = 'المدير العام',
  enabled = true;
