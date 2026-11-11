/*
# Add business identity, address, and contact details

1. Purpose
- Store the customer or administrator's business type, address, legal identifiers, and flexible contact numbers in structured profile fields.
- Copy these details into each order when it is placed so printed invoices keep the exact information used at that time.

2. Modified Tables
- `profiles`
  - `province`: governorate/province.
  - `city`: city.
  - `detailed_address`: full address details.
  - `license_number`: license number.
  - `tax_number`: tax number.
  - `commercial_record`: commercial register number.
  - `contact_numbers`: JSON array of labeled phone numbers such as landline, mobile, WhatsApp, or any custom label.
- `orders`
  - `client_business_type`, `client_province`, `client_city`, `client_address`.
  - `client_license_number`, `client_tax_number`, `client_commercial_record`.
  - `client_contact_numbers`: snapshot of the client's labeled phone numbers at checkout.

3. Behavior
- New sign-ups copy the legal and address fields from sign-up metadata into `profiles`.
- Existing records remain valid; all new fields are nullable or have safe empty defaults.
- Order snapshots are immutable in normal client use because clients can only insert their own orders and the existing admin order policy controls later edits.

4. Security
- Existing authenticated profile ownership and administrator policies continue to protect `profiles`.
- Existing order policies continue to protect `orders`; no anonymous access is added.
- The flexible contact list is stored as data only and is rendered as text by the application.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS detailed_address text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS license_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_number text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS commercial_record text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_numbers jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_business_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_province text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_city text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_address text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_license_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_tax_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_commercial_record text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_contact_numbers jsonb NOT NULL DEFAULT '[]'::jsonb;

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
    true,
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

GRANT SELECT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;
