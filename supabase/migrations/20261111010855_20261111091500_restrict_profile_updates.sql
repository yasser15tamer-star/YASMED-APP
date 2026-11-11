/*
# Restrict profile privilege fields

1. Purpose
- Prevent a signed-in client from changing their own role, enabled state, or business type through a direct database request.
- Keep normal account details editable by their owner.

2. Security Changes
- Revoke broad profile UPDATE access from authenticated users.
- Grant UPDATE only for name, address, legal identifiers, and contact fields.
- Add `admin_set_client_enabled(uuid, boolean)` for administrators to approve or disable client accounts.
- The function checks the caller's administrator status and only changes client profiles.
- Anonymous users cannot call the function.
*/

REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, province, city, detailed_address, license_number, tax_number, commercial_record, contact_numbers) ON profiles TO authenticated;

CREATE OR REPLACE FUNCTION admin_set_client_enabled(p_client_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE profiles
  SET enabled = p_enabled
  WHERE id = p_client_id AND role = 'client';
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_client_enabled(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_client_enabled(uuid, boolean) TO authenticated;
