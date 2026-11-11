-- 1. إنشاء الـ Bucket المخصص لملفات الإكسيل
INSERT INTO storage.buckets (id, name, public)
VALUES ('excel-files', 'excel-files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. السماح للمستخدمين المسجلين (Authenticated Users) برفع الملفات
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'excel-files');

-- 3. السماح للأدمن والعميل برؤية وتحميل الملفات
CREATE POLICY "Allow users to read files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'excel-files');