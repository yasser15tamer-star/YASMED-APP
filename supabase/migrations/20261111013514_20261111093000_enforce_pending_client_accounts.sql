/*
# Enforce pending client accounts at creation

1. Purpose
- Ensure every newly created client account is disabled until an administrator approves it.
- Move this rule into the database trigger so it cannot be bypassed by a browser request or a race in the login screen.

2. Modified Behavior
- `handle_new_user` now sets `enabled` to true only for administrators and false for clients and employees created through sign-up.
- All existing profile fields and sign-up metadata continue to be copied as before.

3. Security
- The approval gate is server-enforced.
- The client-facing profile update path cannot change `enabled` because profile UPDATE privileges were already narrowed in the previous security migration.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (
    id, full_name, role, enabled, business_type, province, city, detailed_address,
    license_number, tax_number, commercial_record, contact_numbers
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'client') = 'admin',
    CASE NEW.raw_user_meta_data->>'businessType'
      WHEN 'wholesale_warehouse' THEN 'wholesale'
      WHEN 'retail_warehouse' THEN 'retail'
      WHEN 'pharmacy' THEN 'pharmacy'
    END,
    NULLIF(NEW.raw_user_meta_data->>'province', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'detailedAddress', ''),
    NULLIF(NEW.raw_user_meta_data->>'licenseNumber', ''),
    NULLIF(NEW.raw_user_meta_data->>'taxNumber', ''),
    NULLIF(NEW.raw_user_meta_data->>'commercialRecord', ''),
    COALESCE(NEW.raw_user_meta_data->'contactNumbers', '[]'::jsonb)
  );
  RETURN NEW;
END;
$$;
