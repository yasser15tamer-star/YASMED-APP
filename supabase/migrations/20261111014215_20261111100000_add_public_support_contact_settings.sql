/*
# Add public support contact settings

1. Purpose
- Store the support person's display name and phone number in the singleton `app_settings` row.
- Let administrators edit these two values from the settings screen.
- Let signed-out visitors read only these two values for the login status window.

2. Modified Tables
- `app_settings`
  - `support_name` text with a default support name.
  - `support_phone` text with a default support phone number.
  - Existing cleanup and audit settings are unchanged.

3. Security
- Replace the broad authenticated read policy on `app_settings` with an administrator-only read policy, so ordinary users cannot read unrelated settings.
- Add `get_support_contact()` as a SECURITY DEFINER RPC that returns only `support_name` and `support_phone` for row id 1.
- Grant the RPC to anon and authenticated so the login page can use it before sign-in; revoke its default PUBLIC execution grant.
- Existing administrator-only update policy remains the only update path.
*/

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS support_name text NOT NULL DEFAULT 'البشمهندس / ياسر تامر (صاحب النظام والمخزن)';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS support_phone text NOT NULL DEFAULT '01013629789';

UPDATE app_settings
SET support_name = 'البشمهندس / ياسر تامر (صاحب النظام والمخزن)'
WHERE id = 1 AND NULLIF(trim(support_name), '') IS NULL;

UPDATE app_settings
SET support_phone = '01013629789'
WHERE id = 1 AND NULLIF(trim(support_phone), '') IS NULL;

DROP POLICY IF EXISTS "read_app_settings" ON app_settings;
DROP POLICY IF EXISTS "admin_select_app_settings" ON app_settings;
CREATE POLICY "admin_select_app_settings" ON app_settings FOR SELECT
TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION get_support_contact()
RETURNS TABLE (support_name text, support_phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.support_name, s.support_phone
  FROM app_settings AS s
  WHERE s.id = 1;
$$;

REVOKE EXECUTE ON FUNCTION get_support_contact() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_support_contact() TO anon, authenticated;
