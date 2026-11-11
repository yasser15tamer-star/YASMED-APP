/*
# Store storefront type on client profiles

Plain-English summary
Each client chooses a storefront type at sign-up (wholesale, retail or pharmacy). This migration saves that choice on the client's profile so the app can show them only the supplier sheets for their type. Clients cannot change this value themselves; only admins can.

1. Modified Tables
- `profiles`: new column `business_type` (text, one of wholesale / retail / pharmacy, nullable for admin and employee accounts).

2. Behavior
- New sign-ups get their type from the sign-up choice (wholesale_warehouse, retail_warehouse, pharmacy).
- Existing client accounts are backfilled from their sign-up data.

3. Security
- A trigger blocks any non-admin from changing `business_type` on a profile.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_type text
  CHECK (business_type IN ('wholesale', 'retail', 'pharmacy'));

UPDATE profiles p
SET business_type = CASE u.raw_user_meta_data->>'businessType'
  WHEN 'wholesale_warehouse' THEN 'wholesale'
  WHEN 'retail_warehouse' THEN 'retail'
  WHEN 'pharmacy' THEN 'pharmacy'
END
FROM auth.users u
WHERE u.id = p.id
  AND p.role = 'client'
  AND p.business_type IS NULL;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, enabled, business_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم جديد'),
    COALESCE(NEW.raw_app_meta_data->>'role', 'client'),
    true,
    CASE NEW.raw_user_meta_data->>'businessType'
      WHEN 'wholesale_warehouse' THEN 'wholesale'
      WHEN 'retail_warehouse' THEN 'retail'
      WHEN 'pharmacy' THEN 'pharmacy'
    END
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION protect_profile_business_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.business_type IS DISTINCT FROM OLD.business_type AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change the business type';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_business_type ON profiles;
CREATE TRIGGER trg_protect_profile_business_type
BEFORE UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION protect_profile_business_type();
