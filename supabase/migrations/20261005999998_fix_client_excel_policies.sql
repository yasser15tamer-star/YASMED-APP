-- 1. تفعيل الحماية على الجدول
alter table client_excel_sheets enable row level security;

-- 2. السماح للعملاء بإضافة الشيتات الخاصة بهم
create policy "Allow clients to insert their excel sheets"
on client_excel_sheets for insert
to authenticated
with CHECK (auth.uid() = client_id);

-- 3. السماح للعملاء والأدمن برؤية الشيتات
create policy "Allow users to view excel sheets"
on client_excel_sheets for select
to authenticated
using (true);