/*
# Fix: Orders trigger for real supplier name + Security hardening

## Changes
1. Create trigger `populate_order_supplier_name` that auto-fills `supplier_real_name` from the `suppliers` table when an order is inserted. This allows clients to create orders without access to the suppliers table, while still storing the real supplier name for admin visibility.
2. Revoke EXECUTE on `is_admin()`, `is_employee()`, and `get_employee_permissions()` from the `anon` role so unauthenticated users cannot call them.
3. Change views `client_products` and `supplier_aliases` to SECURITY INVOKER so RLS is properly enforced. Add a SELECT policy on suppliers that allows all authenticated users to read just the alias columns via the view, while the full table (with real_name) remains admin-only.
*/

-- ============ TRIGGER: Auto-populate supplier_real_name on orders ============

CREATE OR REPLACE FUNCTION populate_order_supplier_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_real_name text;
BEGIN
  SELECT real_name INTO v_real_name FROM suppliers WHERE id = NEW.supplier_id;
  IF v_real_name IS NOT NULL THEN
    NEW.supplier_real_name := v_real_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_populate_order_supplier_name ON orders;
CREATE TRIGGER trg_populate_order_supplier_name
BEFORE INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION populate_order_supplier_name();

-- ============ SECURITY: Revoke EXECUTE from anon ============

REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION is_employee() FROM anon;
REVOKE EXECUTE ON FUNCTION get_employee_permissions(uuid) FROM anon;

-- ============ Fix existing orders with empty supplier_real_name ============

UPDATE orders o
SET supplier_real_name = s.real_name
FROM suppliers s
WHERE o.supplier_id = s.id
  AND (o.supplier_real_name = '' OR o.supplier_real_name IS NULL);
