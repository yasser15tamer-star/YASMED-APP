/*
# Client catalog function

Plain-English summary
Clients compare their shortage list against supplier products. This function returns only the products for the signed-in client's storefront type, and shows suppliers by their display name (alias) only, never the real supplier name.

1. Function
- `get_client_catalog()` returns product name, supplier id, supplier display name, price, discount, final price and quantity.
- Only enabled client accounts receive rows, and only for suppliers whose storefront type matches their own.

2. Security
- Executable by signed-in users only; anonymous access is revoked.
- Runs with elevated rights, so it reads only the columns listed above and filters by the caller's own profile.
*/

CREATE OR REPLACE FUNCTION get_client_catalog()
RETURNS TABLE (
  product_name text,
  supplier_id uuid,
  supplier_alias text,
  price numeric,
  discount numeric,
  final_price numeric,
  quantity integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.product_name,
    sp.supplier_id,
    COALESCE(NULLIF(btrim(s.alias_name), ''), 'مخزن') AS supplier_alias,
    sp.price,
    sp.discount,
    sp.final_price,
    sp.quantity
  FROM supplier_products sp
  JOIN suppliers s ON s.id = sp.supplier_id
  JOIN profiles p ON p.id = auth.uid() AND p.enabled = true
  WHERE s.business_type = p.business_type
  ORDER BY sp.id;
$$;

REVOKE ALL ON FUNCTION get_client_catalog() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_client_catalog() TO authenticated;

NOTIFY pgrst, 'reload schema';
