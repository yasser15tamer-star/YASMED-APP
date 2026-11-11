import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export function ClientUpload() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !file) {
      setError('الرجاء اختيار ملف إكسيل أولاً');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const fileData = await convertToBase64(file);
      const { error: insertError } = await supabase.from('client_excel_sheets').insert({
        client_id: profile.id,
        client_name: profile.full_name,
        file_name: file.name,
        file_data: fileData,
        notes: notes,
        status: 'pending',
      });
      if (insertError) throw insertError;

      setSuccess('تم إرسال شيت الإكسيل بنجاح للأدمن!');
      setFile(null);
      setNotes('');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الإرسال');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">إرسال ملفات الإكسيل للمورد / الأدمن</h2>
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {success}</div>}
      <Card>
        <CardBody>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">اختر ملف الإكسيل (.xlsx, .xls, .csv)</label>
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-teal-500 transition-colors bg-slate-50/50">
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" id="excel-upload-input" />
                <label htmlFor="excel-upload-input" className="cursor-pointer flex flex-col items-center">
                  <FileSpreadsheet className="w-12 h-12 text-teal-600 mb-2" />
                  <span className="text-sm font-bold text-slate-700">{file ? file.name : 'اضغط هنا لاختيار ملف الإكسيل'}</span>
                  <span className="text-xs text-slate-400 mt-1">الملف سيتم إرساله للأدمن للمراجعة</span>
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">ملاحظات إضافية (اختياري)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اكتب أي تفاصيل أو ملاحظات تخص الشيت..." className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:border-teal-500 bg-white" rows={3} />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={uploading || !file}>
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              إرسال الشيت للأدمن
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}