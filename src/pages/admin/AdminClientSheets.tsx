import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { FileSpreadsheet, Loader2, Download, Trash2, CheckSquare, Square, AlertCircle, Trash } from 'lucide-react';

interface ExcelSheet {
  id: string;
  client_id: string;
  client_name: string | null;
  file_name: string;
  file_data: string | null;
  notes: string | null;
  created_at: string;
}

export function AdminClientSheets() {
  const [sheets, setSheets] = useState<ExcelSheet[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheets = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from('client_excel_sheets')
      .select('id, client_id, client_name, file_name, file_data, notes, created_at')
      .order('created_at', { ascending: false });
    if (queryError) setError('فشل في جلب شيتات العملاء');
    else setSheets(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSheets(); }, [fetchSheets]);

  const deleteSheets = async (ids: string[]) => {
    const { error: deleteError } = await supabase.from('client_excel_sheets').delete().in('id', ids);
    if (deleteError) {
      setError('حدث خطأ أثناء الحذف');
      return;
    }
    setSheets(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === sheets.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(sheets.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل أنت متأكد من حذف هذا الشيت؟')) return;
    deleteSheets([id]);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${selectedIds.length} من الشيتات المحددة؟`)) return;
    deleteSheets(selectedIds);
  };

  const handleDeleteAll = () => {
    if (sheets.length === 0) return;
    if (!window.confirm('تحذير: هل أنت متأكد من حذف جميع الشيتات المرسلة بالكامل؟')) return;
    deleteSheets(sheets.map(s => s.id));
  };

  const handleDownload = (fileData: string | null, fileName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!fileData) {
      setError('بيانات الملف غير موجودة');
      return;
    }

    const a = document.createElement('a');
    a.href = fileData;
    a.download = fileName || 'sheet.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">شيتات الإكسيل المرسلة من العملاء</h2>

        {sheets.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={toggleSelectAll}
              variant="outline"
              size="sm"
              className="border-slate-200 text-slate-700"
            >
              {selectedIds.length === sheets.length ? <CheckSquare className="w-4 h-4 ml-1 text-teal-600" /> : <Square className="w-4 h-4 ml-1" />}
              {selectedIds.length === sheets.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>

            {selectedIds.length > 0 && (
              <Button
                onClick={handleDeleteSelected}
                variant="outline"
                size="sm"
                className="border-red-200 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 ml-1 text-red-500" />
                حذف المحدد ({selectedIds.length})
              </Button>
            )}

            <Button
              onClick={handleDeleteAll}
              variant="outline"
              size="sm"
              className="border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
            >
              <Trash className="w-4 h-4 ml-1 text-red-600" />
              حذف الكل
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>
      ) : sheets.length === 0 ? (
        <Card><CardBody className="text-center py-12"><FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">لا توجد شيتات إكسيل مرسلة حالياً</p></CardBody></Card>
      ) : (
        <div className="space-y-4">
          {sheets.map((sheet) => {
            const isSelected = selectedIds.includes(sheet.id);
            return (
              <Card
                key={sheet.id}
                className={`cursor-pointer transition-all border-2 ${isSelected ? 'border-teal-500 bg-teal-50/20 shadow-md' : 'border-slate-100 hover:border-slate-200'}`}
                onClick={(e) => toggleSelectOne(sheet.id, e)}
              >
                <CardBody className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <button
                      type="button"
                      onClick={(e) => toggleSelectOne(sheet.id, e)}
                      className="mt-1 text-slate-400 hover:text-teal-600 transition-colors"
                      title={isSelected ? "إلغاء التحديد" : "تحديد الشيت"}
                    >
                      {isSelected ? <CheckSquare className="w-6 h-6 text-teal-600" /> : <Square className="w-6 h-6" />}
                    </button>
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                      <FileSpreadsheet className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{sheet.file_name}</h3>
                      <p className="text-sm text-slate-500">من العميل: <span className="font-semibold text-teal-600">{sheet.client_name || 'عميل'}</span></p>
                      {sheet.notes && (
                        <p className="text-xs text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          ملاحظات العميل: {sheet.notes}
                        </p>
                      )}
                      <span className="text-xs text-slate-400 block mt-2">
                          تاريخ الإرسال: {new Date(sheet.created_at).toLocaleString('ar-EG')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                    <Button
                      onClick={(e) => handleDownload(sheet.file_data, sheet.file_name, e)}
                      variant="outline"
                      size="sm"
                      className="border-teal-200 text-teal-700 hover:bg-teal-50"
                    >
                      <Download className="w-4 h-4 ml-1.5 text-teal-600" />
                      تحميل
                    </Button>
                    <Button
                      onClick={(e) => handleDeleteSingle(sheet.id, e)}
                      variant="outline"
                      size="sm"
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 ml-1.5 text-red-500" />
                      حذف
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
