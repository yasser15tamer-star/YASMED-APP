/*
# Create and secure client Excel sheet storage

Plain-English summary
Client uploaded sheets are saved in the database. A client can send a sheet and see only their own sheets. Admins can see every sheet and delete them.

1. New Tables
- `client_excel_sheets` (if it does not exist yet): id, client_id (the sending client), client_name, file_name, file_data (the file content), notes, status, created_at.

2. Security
- RLS enabled on `client_excel_sheets`.
- Any previous policies on the table are removed and replaced with:
  - INSERT: a client can add a sheet only for themselves.
  - SELECT: a client sees their own sheets; admins see all.
  - DELETE: admins only.
- Grants: authenticated users get SELECT, INSERT and DELETE; RLS decides which rows.
*/

CREATE TABLE IF NOT EXISTS client_excel_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name text,
  file_name text NOT NULL,
  file_data text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_excel_sheets ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_excel_sheets' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON client_excel_sheets', r.policyname);
  END LOOP;
END $$;

GRANT SELECT, INSERT, DELETE ON client_excel_sheets TO authenticated;

CREATE POLICY "insert_own_client_sheets" ON client_excel_sheets FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = client_id);

CREATE POLICY "select_own_or_admin_client_sheets" ON client_excel_sheets FOR SELECT
  TO authenticated USING (auth.uid() = client_id OR is_admin());

CREATE POLICY "delete_admin_client_sheets" ON client_excel_sheets FOR DELETE
  TO authenticated USING (is_admin());
