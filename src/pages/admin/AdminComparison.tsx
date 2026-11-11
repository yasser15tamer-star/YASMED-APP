import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { parseExcelFile } from '@/lib/excel';
import { Upload, AlertCircle, CheckCircle2, Loader2, Save, FileText, X, Eye, EyeOff, CheckSquare, Square } from 'lucide-react';

interface AdminComparisonProps {
  onDataSaved?: () => void;
}

interface UploadedFileItem {
  file: File;
  fileName: string;
  alias: string;
  businessType: 'wholesale' | 'retail' | 'pharmacy';
  products: { product_name: string; price: number; discount: number }[];
  showPreview?: boolean;
  selected?: boolean;
}

export function AdminComparison({ onDataSaved }: AdminComparisonProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nameKeywords = ['اسم الصنف', 'الصنف', 'البيان', 'اسم الدواء', 'product', 'item', 'name'];
  const priceKeywords = ['السعر', 'سعر', 'سعر البيع', 'price', 'الجمهور'];
  const discountKeywords = ['الخصم', 'خصم', 'نسبة الخصم', 'discount'];

  const findColumnKeys = (row: any) => {
    let nameKey = null;
    let priceKey = null;
    let discountKey = null;

    if (typeof row === 'object' && row !== null) {
      const keys = Object.keys(row);
      for (const key of keys) {
        const lowerKey = key.toString().toLowerCase().trim();
        if (!nameKey && nameKeywords.some(k => lowerKey.includes(k))) nameKey = key;
        else if (!priceKey && priceKeywords.some(k => lowerKey.includes(k))) priceKey = key;
        else if (!discountKey && discountKeywords.some(k => lowerKey.includes(k))) discountKey = key;

        const cellValue = String(row[key] || '').toLowerCase().trim();
        if (!nameKey && nameKeywords.some(k => cellValue.includes(k))) nameKey = key;
        else if (!priceKey && priceKeywords.some(k => cellValue.includes(k))) priceKey = key;
        else if (!discountKey && discountKeywords.some(k => cellValue.includes(k))) discountKey = key;
      }
    }
    return { nameKey, priceKey, discountKey };
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const newFilesList: UploadedFileItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const realFileName = file.name.replace(/\.[^/.]+$/, "");
        const parsed = await parseExcelFile(file);

        const fileProducts: { product_name: string; price: number; discount: number }[] = [];

        for (const sheetName of Object.keys(parsed)) {
            const rows = parsed[sheetName] as any[];
            if (rows && Array.isArray(rows) && rows.length > 0) {
              let headerFound = false;
              let nameCol: string | null = null;
              let priceCol: string | null = null;
              let discountCol: string | null = null;

              for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex++) {
                  const keys = findColumnKeys(rows[rowIndex]);
                  if (keys.nameKey || keys.priceKey) {
                      nameCol = keys.nameKey;
                      priceCol = keys.priceKey;
                      discountCol = keys.discountKey;
                      headerFound = true;
                      break;
                  }
              }

              if (!headerFound) {
                  const firstRowKeys = Object.keys(rows[0] || {});
                  if(firstRowKeys.length > 0) nameCol = firstRowKeys[0];
                  if(firstRowKeys.length > 1) priceCol = firstRowKeys[1];
                  if(firstRowKeys.length > 2) discountCol = firstRowKeys[2];
              }

              rows.forEach((row: any) => {
                let name = nameCol ? row[nameCol] : undefined;
                let priceRaw = priceCol ? row[priceCol] : undefined;
                let discountRaw = discountCol ? row[discountCol] : undefined;

                if (typeof name === 'string') name = name.trim();
                const price = parseFloat(String(priceRaw).replace(/[^0-9.]/g, ''));
                const discount = parseFloat(String(discountRaw).replace(/[^0-9.]/g, ''));

                if (name && typeof name === 'string' && name.length > 1 && !isNaN(price)) {
                    if (!nameKeywords.some(k => name.toLowerCase().includes(k))) {
                        fileProducts.push({
                            product_name: name,
                            price: price,
                            discount: isNaN(discount) ? 0 : discount,
                        });
                    }
                }
              });
            }
        }

        if (fileProducts.length > 0) {
          newFilesList.push({
            file: file,
            fileName: realFileName,
            alias: realFileName,
            businessType: 'wholesale',
            products: fileProducts,
            showPreview: false,
            selected: false
          });
        }
      }

      setUploadedFiles(prev => [...prev, ...newFilesList]);
      setSuccess("تم قراءة الشيتات بنجاح.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error("Excel parsing error:", err);
      setError('فشل في قراءة ملفات الإكسيل.');
    }
    setLoading(false);
  };

  const updateFileAlias = (index: number, newAlias: string) => {
    const updated = [...uploadedFiles];
    updated[index].alias = newAlias;
    setUploadedFiles(updated);
  };

  const updateBusinessType = (index: number, type: 'wholesale' | 'retail' | 'pharmacy') => {
    const updated = [...uploadedFiles];
    updated[index].businessType = type;
    setUploadedFiles(updated);
  };

  const toggleSelectFile = (index: number) => {
    const updated = [...uploadedFiles];
    updated[index].selected = !updated[index].selected;
    setUploadedFiles(updated);
  };

  const toggleSelectAll = () => {
    const allSelected = uploadedFiles.every(f => f.selected);
    const updated = uploadedFiles.map(f => ({ ...f, selected: !allSelected }));
    setUploadedFiles(updated);
  };

  const applyBulkBusinessType = (type: 'wholesale' | 'retail' | 'pharmacy') => {
    const updated = uploadedFiles.map(f => f.selected ? { ...f, businessType: type } : f);
    setUploadedFiles(updated);
  };

  const togglePreview = (index: number) => {
    const updated = [...uploadedFiles];
    updated[index].showPreview = !updated[index].showPreview;
    setUploadedFiles(updated);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  const handleSaveToDatabase = async () => {
    if (uploadedFiles.length === 0) {
      setError('لا توجد ملفات للحفظ');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      let totalInserted = 0;

      for (const item of uploadedFiles) {
        let supplierId: string | null = null;
        const aliasValue = item.alias || item.fileName;

        const { data: existingSuppliers } = await supabase
          .from('suppliers')
          .select('*')
          .eq('real_name', item.file.name)
          .eq('business_type', item.businessType)
          .limit(1);

        if (existingSuppliers && existingSuppliers.length > 0) {
          supplierId = existingSuppliers[0].id;
          
          await supabase
            .from('suppliers')
            .update({ 
              alias_name: aliasValue,
              business_type: item.businessType 
            })
            .eq('id', supplierId);
        } else {
          const insertPayload = {
            real_name: item.file.name,
            alias_name: aliasValue,
            business_type: item.businessType,
          };

          const { data: newSupp, error: suppErr } = await supabase
            .from('suppliers')
            .insert(insertPayload)
            .select('id')
            .single();

          if (suppErr) throw suppErr;
          if (newSupp) supplierId = newSupp.id;
        }

        if (!supplierId) {
          throw new Error('فشل في تحديد معرف المورد (supplier_id) لربط المنتجات.');
        }

        await supabase.from('supplier_products').delete().eq('supplier_id', supplierId);

        const recordsToInsert = item.products.map(p => ({
          supplier_id: supplierId,
          product_name: p.product_name,
          price: p.price,
          discount: p.discount,
          final_price: p.price - (p.price * (p.discount || 0)) / 100,
          quantity: 0,
        }));

        const chunkSize = 1000;
        for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
          const chunk = recordsToInsert.slice(i, i + chunkSize);
          const { error: insertError } = await supabase
            .from('supplier_products')
            .insert(chunk);

          if (insertError) throw insertError;
        }
        totalInserted += recordsToInsert.length;
      }

      setSuccess(`تم حفظ وتخزين ${totalInserted} صنف وتوجيه الشيتات لأقسامها بنجاح في قاعدة البيانات!`);
      if (onDataSaved) onDataSaved();

      setTimeout(() => {
        setSuccess(null);
        setUploadedFiles([]);
      }, 4000);

    } catch (err: any) {
      console.error("Database save error:", err);
      setError(err.message || 'حدث خطأ أثناء الحفظ في قاعدة البيانات.');
    }
    setSaving(false);
  };

  const selectedCount = uploadedFiles.filter(f => f.selected).length;
  const allChecked = uploadedFiles.length > 0 && uploadedFiles.every(f => f.selected);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">لوحة الأدمن: إدارة شيتات الموردين وتوجيهها للأقسام</h2>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      <Card>
        <CardBody className="p-8">
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-teal-400 transition-colors cursor-pointer mb-6"
            onClick={() => document.getElementById('admin-multi-files')?.click()}
          >
            {loading ? (
              <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-3" />
            ) : (
              <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            )}
            <p className="text-slate-600 font-medium mb-1">اضغط لرفع شيتات الموردين (يمكنك رفع عدة ملفات وتوجيه كل ملف لنوعه الصحيح)</p>
            <input
              id="admin-multi-files"
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={e => handleFileSelect(e.target.files)}
            />
          </div>

          {uploadedFiles.length > 0 && (
            <div className="space-y-6">
              
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-teal-50 border border-teal-200">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-teal-900 font-bold text-sm hover:text-teal-700"
                  >
                    {allChecked ? <CheckSquare className="w-5 h-5 text-teal-600" /> : <Square className="w-5 h-5 text-teal-600" />}
                    تحديد الكل ({uploadedFiles.length})
                  </button>
                  <span className="text-xs bg-teal-200 text-teal-800 px-2.5 py-1 rounded-full font-medium">
                    محدد: {selectedCount} ملف
                  </span>
                </div>

                {selectedCount > 0 && (
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <span className="text-xs font-bold text-teal-900 shrink-0">تعيين وجهة الشيت للمحدد:</span>
                    <Button size="sm" variant="outline" onClick={() => applyBulkBusinessType('wholesale')} className="bg-white hover:bg-teal-100 text-xs">
                      مخزن / جملة
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyBulkBusinessType('retail')} className="bg-white hover:bg-teal-100 text-xs">
                      قطاعي
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => applyBulkBusinessType('pharmacy')} className="bg-white hover:bg-teal-100 text-xs">
                      صيدلية
                    </Button>
                  </div>
                )}
              </div>

              <h3 className="font-bold text-slate-700">الملفات المرفوعة:</h3>

              <div className="space-y-4">
                {uploadedFiles.map((item, index) => (
                  <div key={index} className={`p-4 rounded-xl border transition-all ${item.selected ? 'border-teal-500 bg-teal-50/30' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      
                      <div className="flex items-center gap-3 flex-1">
                        <button onClick={() => toggleSelectFile(index)} className="text-teal-600 hover:text-teal-800">
                          {item.selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </button>
                        <FileText className="w-8 h-8 text-teal-600 shrink-0" />
                        <div>
                          <p className="text-xs text-slate-500">اسم الملف: <span className="font-bold text-slate-800">{item.file.name}</span></p>
                          <p className="text-xs text-emerald-600 font-medium mt-0.5">{item.products.length} صنف متاح</p>
                        </div>
                      </div>

                      <div className="w-full md:w-1/4">
                        <label className="block text-xs font-bold text-slate-600 mb-1">الاسم المستعار:</label>
                        <input
                          type="text"
                          value={item.alias}
                          onChange={e => updateFileAlias(index, e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-teal-500"
                        />
                      </div>

                      <div className="w-full md:w-1/4">
                        <label className="block text-xs font-bold text-slate-600 mb-1">صفحة الوجهة (التصنيف):</label>
                        <select
                          value={item.businessType}
                          onChange={e => updateBusinessType(index, e.target.value as any)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-teal-500 font-semibold"
                        >
                          <option value="wholesale">مخزن / جملة (Wholesale)</option>
                          <option value="retail">قطاعي (Retail)</option>
                          <option value="pharmacy">صيدلية (Pharmacy)</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 self-end md:self-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => togglePreview(index)}
                          className="flex items-center gap-1"
                        >
                          {item.showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          {item.showPreview ? "إخفاء" : "معاينة"}
                        </Button>

                        <button
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {item.showPreview && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-100 text-slate-600 sticky top-0">
                              <tr>
                                <th className="p-2">اسم الصنف</th>
                                <th className="p-2">السعر</th>
                                <th className="p-2">الخصم</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.products.slice(0, 50).map((p, pIdx) => (
                                <tr key={pIdx} className="hover:bg-slate-50">
                                  <td className="p-2 text-slate-700 font-medium">{p.product_name}</td>
                                  <td className="p-2 text-slate-600">{p.price} ج.م</td>
                                  <td className="p-2 text-amber-600">{p.discount}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full"
                onClick={handleSaveToDatabase}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                حفظ الشيتات وتوجيه كل ملف لصفحته المخصصة في قاعدة البيانات
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}