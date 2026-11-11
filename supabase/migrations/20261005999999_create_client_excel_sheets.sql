-- 1. إنشاء جدول client_excel_sheets بالأعمدة الصحيحة
create table if not exists client_excel_sheets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references auth.users(id),
  client_name text,
  file_name text,
  file_data text,
  notes text,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. تفعيل الحماية والسماح للإضافة
alter table client_excel_sheets enable row level security;

create policy "Allow clients to insert their excel sheets"
on client_excel_sheets for insert
to authenticated
with check (auth.uid() = client_id);

create policy "Allow users to view excel sheets"
on client_excel_sheets for select
to authenticated
using (true);