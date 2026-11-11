/*
# Add storefront type to suppliers

Plain-English summary
Each supplier sheet belongs to one storefront page: wholesale, retail or pharmacy. The supplier table was missing the column that records this, so saving sheets to a storefront failed. This adds it.

1. Modified Tables
- `suppliers`: new column `business_type` (text, one of wholesale / retail / pharmacy). Existing suppliers keep an empty value until they are re-uploaded or edited in their storefront page.

2. Security
- No change to access rules; existing policies still apply.
*/

ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS business_type text
  CHECK (business_type IN ('wholesale', 'retail', 'pharmacy'));

CREATE INDEX IF NOT EXISTS idx_suppliers_business_type ON suppliers (business_type);
