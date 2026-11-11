/*
# Fix: Auth login failure - NULL values in auth.users

## Problem
The admin seed account was inserted directly into auth.users via SQL.
Supabase Auth expects string columns to contain empty strings (not NULL).
NULL values cause "Database error querying schema" on login.

## Fix
Set all nullable string columns that Auth expects to be non-NULL to empty
strings. Timestamp columns are left NULL (Auth handles those). This matches
what Supabase Auth would set when creating a user through its API.
*/

UPDATE auth.users SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  phone = COALESCE(phone, '')
WHERE email = 'admin@center.com';
