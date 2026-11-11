/*
# Track rejected client accounts

Plain-English summary
When an admin rejects a pending client, the account is permanently deleted. This table remembers the email of rejected accounts so that when that person tries to sign in later, the app can explain that their request was rejected instead of showing a generic error.

1. New Tables
- `rejected_accounts`
  - `email` (text, primary key, stored lowercase)
  - `rejected_at` (timestamptz, when the rejection happened)

2. New Functions
- `is_rejected_email(p_email text)` returns true when the email is in `rejected_accounts`. Used by the sign-in screen after a failed login.

3. Security
- RLS enabled on `rejected_accounts` with no policies, so no browser role can read or write it directly.
- Only the server (service role, used by the delete-client edge function) can write to the table.
- `is_rejected_email` is the only public path, and it returns a single boolean.
*/

CREATE TABLE IF NOT EXISTS rejected_accounts (
  email text PRIMARY KEY,
  rejected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rejected_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON rejected_accounts TO service_role;

CREATE OR REPLACE FUNCTION is_rejected_email(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rejected_accounts WHERE email = lower(trim(p_email))
  );
$$;

REVOKE EXECUTE ON FUNCTION is_rejected_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_rejected_email(text) TO anon, authenticated;
