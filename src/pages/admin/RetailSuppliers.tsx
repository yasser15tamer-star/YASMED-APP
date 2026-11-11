import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase, type Supplier, type SupplierProduct } from '@/lib/supabase';
import { parseExcelFile, extractSupplierProducts, type SupplierProductRow } from '@/lib/excel';
import { bulkDeleteSuppliers, bulkSetSupplierAlias } from '@/lib/supplierBulk';
import { SupplierBulkToolbar, BulkAliasModal } from '@/components/admin/SupplierBulkTools';
import { Upload, Plus, Trash2, Store, Package, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff, X, Edit2, CheckSquare, Square } from 'lucide-react';

export function RetailSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [newRealName, setNewRealName] = useState('');
  const [newAliasName, setNewAliasName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<SupplierProductRow[] | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [showRealNames, setShowRealNames] = useState(true);
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkAlias, setShowBulkAlias] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await supabase
        .from('suppliers')
        .select('*')
        .eq('business_type', 'retail')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setSuppliers(data || []);
    } catch (err) {
      console.error(err);
      setError('فشل في تحميل قائمة موردين القطاعي');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  const handleAddSupplier = async () => {
    if (!newRealName.trim() || !newAliasName.trim()) {
      setError('يرجى إدخال الاسم الحقيقي والاسم المستعار');
      return;
    }
    setError(null);
    try {
      const { error: insertError } = await supabase.from('suppliers').insert({
        real_name: newRealName.trim(),
        alias_name: newAliasName.trim(),
        business_type: 'retail',
      });
      if (insertError) throw insertError;
      setSuccess('تم إضافة مورد القطاعي بنجاح');
      setNewRealName('');
      setNewAliasName('');
      setShowAddModal(false);
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل في إضافة المورد');
    }
  };

  const handleEditSupplier = async () => {
    if (!editSupplier || !newRealName.trim() || !newAliasName.trim()) return;
    try {
      const { error: updateError } = await supabase.from('suppliers').update({
        real_name: newRealName.trim(),
        alias_name: newAliasName.trim(),
        business_type: 'retail',
      }).eq('id', editSupplier.id);
      if (updateError) throw updateError;
      setSuccess('تم تحديث بيانات المورد بنجاح');
      setEditSupplier(null);
      setNewRealName('');
      setNewAliasName('');
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'فشل في تحديث المورد');
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المورد؟ سيتم حذف جميع منتجاته.')) return;
    try {
      await supabase.from('supplier_products').delete().eq('supplier_id', id);
      const { error: deleteError } = await supabase.from('suppliers').delete().eq('id', id);

      if (deleteError) throw deleteError;

      setSuccess('تم حذف المورد بنجاح');
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('فشل في حذف المورد');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleToggleAll = () => {
    setSelectedIds(prev => (prev.length === suppliers.length ? [] : suppliers.map(s => s.id)));
  };

  const runBulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${ids.length} مورد؟ سيتم حذف جميع منتجاتهم.`)) return;
    try {
      await bulkDeleteSuppliers(ids);
      setSuccess(`تم حذف ${ids.length} مورد بنجاح`);
      setSelectedIds([]);
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('فشل في حذف الموردين');
    }
  };

  const handleBulkAlias = async (alias: string): Promise<string | null> => {
    try {
      await bulkSetSupplierAlias('retail', alias);
      setSuccess('تم تغيير الاسم المستعار لكل موردين القطاعي');
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
      return null;
    } catch (err) {
      console.error(err);
      return 'فشل في تغيير الأسماء المستعارة';
    }
  };

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const parsed = await parseExcelFile(file);
      const products = extractSupplierProducts(parsed);
      if (products.length === 0) {
        setError('لم يتم العثور على منتجات في الملف');
        setUploading(false);
        return;
      }
      setUploadPreview(products);
      setUploadFileName(file.name);
    } catch {
      setError('فشل في قراءة الملف');
    }
    setUploading(false);
  };

  const handleUploadConfirm = async () => {
    if (!selectedSupplierId || !uploadPreview) return;
    setUploading(true);
    setError(null);
    try {
      await supabase.from('supplier_products').delete().eq('supplier_id', selectedSupplierId);

      const newProducts = uploadPreview.map(p => ({
        supplier_id: selectedSupplierId,
        product_name: p.product_name,
        price: p.price,
        discount: p.discount,
        final_price: p.final_price,
        quantity: p.quantity,
      }));

      const { error: insertError } = await supabase.from('supplier_products').insert(newProducts);
      if (insertError) throw insertError;

      setSuccess(`تم رفع ${newProducts.length} منتج قطاعي بنجاح`);
      setUploadPreview(null);
      setUploadFileName('');
      setSelectedSupplierId(null);
      await fetchSuppliers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error(err);
      setError('فشل في حفظ المنتجات');
    }
    setUploading(false);
  };

  const handleViewProducts = async (supplier: Supplier) => {
    setViewingSupplier(supplier);
    setLoadingProducts(true);
    try {
      const { data, error: queryError } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('product_name', { ascending: true });

      if (queryError) throw queryError;
      setSupplierProducts(data || []);
    } catch (err) {
      console.error(err);
      setError('فشل في تحميل المنتجات');
    }
    setLoadingProducts(false);
  };

  const renderSupplierCard = (supplier: Supplier) => (
    <Card key={supplier.id} className={`hover:shadow-md transition-shadow ${selectedIds.includes(supplier.id) ? 'ring-2 ring-blue-500' : ''}`}>
      <CardBody>
        <div className="flex items-start justify-between mb-3">
          <button type="button" onClick={() => toggleSelected(supplier.id)} className="mt-2 ml-2 text-slate-400 hover:text-blue-600 transition-colors shrink-0" aria-label="تحديد المورد">
            {selectedIds.includes(supplier.id) ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">{showRealNames ? supplier.real_name : supplier.alias_name}</p>
              <p className="text-xs text-slate-400">{showRealNames ? `المستعار: ${supplier.alias_name}` : `الحقيقي: مخفي`}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleViewProducts(supplier)}>
            <Package className="w-3.5 h-3.5 ml-1.5" /> عرض
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setSelectedSupplierId(supplier.id); setUploadPreview(null); setUploadFileName(''); }}>
            <Upload className="w-3.5 h-3.5 ml-1.5" /> رفع
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setEditSupplier(supplier); setNewRealName(supplier.real_name); setNewAliasName(supplier.alias_name); }}>
            <Edit2 className="w-3.5 h-3.5 ml-1.5" /> تعديل
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDeleteSupplier(supplier.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </CardBody>
    </Card>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-600"></span>
          <h2 className="text-2xl font-bold text-slate-800">إدارة موردين ومخازن القطاعي</h2>
          <Badge variant="secondary" className="mr-2">{suppliers.length}</Badge>
        </div>
        <Button onClick={() => { setNewRealName(''); setNewAliasName(''); setShowAddModal(true); }}>
          <Plus className="w-4 h-4 ml-1.5" /> إضافة مورد قطاعي
        </Button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {success}</div>}

      <div className="flex items-center gap-2 mb-6">
        <Button variant="outline" size="sm" onClick={() => setShowRealNames(!showRealNames)}>
          {showRealNames ? <EyeOff className="w-4 h-4 ml-1.5" /> : <Eye className="w-4 h-4 ml-1.5" />}
          {showRealNames ? 'إخفاء الأسماء الحقيقية' : 'إظهار الأسماء الحقيقية'}
        </Button>
      </div>

      <SupplierBulkToolbar
        total={suppliers.length}
        selectedCount={selectedIds.length}
        onToggleAll={handleToggleAll}
        onDeleteSelected={() => runBulkDelete(selectedIds)}
        onDeleteAll={() => runBulkDelete(suppliers.map(s => s.id))}
        onOpenAlias={() => setShowBulkAlias(true)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div>
      ) : suppliers.length === 0 ? (
        <Card><CardBody className="text-center py-12"><Store className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">لا يوجد موردين قطاعي مضافين بعد</p></CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(renderSupplierCard)}
        </div>
      )}

      {selectedSupplierId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setSelectedSupplierId(null); setUploadPreview(null); }}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">رفع ملف Excel للمورد</h3>
              <button onClick={() => { setSelectedSupplierId(null); setUploadPreview(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {!uploadPreview ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-blue-400 transition-colors cursor-pointer" onClick={() => document.getElementById('retail-file-input')?.click()}>
                  {uploading ? <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" /> : <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
                  <p className="text-slate-600 font-medium mb-1">اضغط لاختيار ملف Excel</p>
                  <p className="text-xs text-slate-400">يدعم .xlsx, .xls, .csv</p>
                  <input id="retail-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700">تم قراءة {uploadPreview.length} منتج من {uploadFileName}</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50"><tr><th className="text-right p-3 font-semibold text-slate-600">اسم المنتج</th><th className="text-right p-3 font-semibold text-slate-600">السعر</th><th className="text-right p-3 font-semibold text-slate-600">الخصم</th><th className="text-right p-3 font-semibold text-slate-600">النهائي</th><th className="text-right p-3 font-semibold text-slate-600">الكمية</th></tr></thead>
                      <tbody>
                        {uploadPreview.slice(0, 50).map((p, i) => (
                          <tr key={i} className="border-t border-slate-50"><td className="p-3 text-slate-700">{p.product_name}</td><td className="p-3 text-slate-600">{p.price}</td><td className="p-3 text-slate-600">{p.discount}%</td><td className="p-3 text-slate-600">{p.final_price.toFixed(2)}</td><td className="p-3 text-slate-600">{p.quantity}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            {uploadPreview && (
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setUploadPreview(null); setUploadFileName(''); }}>إلغاء</Button>
                <Button className="flex-1" onClick={handleUploadConfirm} disabled={uploading}>{uploading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <CheckCircle2 className="w-4 h-4 ml-2" />} تأكيد الرفع ({uploadPreview.length})</Button>
              </div>
            )}
          </div>
        </div>
      )}

      {viewingSupplier && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setViewingSupplier(null)}>
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h3 className="text-lg font-bold text-slate-800">منتجات المورد</h3><p className="text-sm text-slate-500">{showRealNames ? viewingSupplier.real_name : viewingSupplier.alias_name}</p></div>
              <button onClick={() => setViewingSupplier(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {loadingProducts ? <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-blue-600 animate-spin" /></div> :
                supplierProducts.length === 0 ? <div className="text-center py-8"><Package className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-slate-500">لا توجد منتجات مرفوعة لهذا المورد</p></div> : (
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50"><tr><th className="text-right p-3 font-semibold text-slate-600">المنتج</th><th className="text-right p-3 font-semibold text-slate-600">السعر</th><th className="text-right p-3 font-semibold text-slate-600">الخصم</th><th className="text-right p-3 font-semibold text-slate-600">النهائي</th><th className="text-right p-3 font-semibold text-slate-600">الكمية</th></tr></thead>
                      <tbody>
                        {supplierProducts.map(p => (
                          <tr key={p.id} className="border-t border-slate-50"><td className="p-3 text-slate-700">{p.product_name}</td><td className="p-3 text-slate-600">{p.price}</td><td className="p-3 text-slate-600">{p.discount}%</td><td className="p-3 text-slate-600">{p.final_price}</td><td className="p-3 text-slate-600">{p.quantity}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      <BulkAliasModal open={showBulkAlias} count={suppliers.length} onClose={() => setShowBulkAlias(false)} onSubmit={handleBulkAlias} />

      {(showAddModal || editSupplier) && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditSupplier(null); }}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">{editSupplier ? 'تعديل مورد قطاعي' : 'إضافة مورد قطاعي جديد'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditSupplier(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="الاسم الحقيقي (للإدمن فقط)" placeholder="اسم المورد الحقيقي" value={newRealName} onChange={e => setNewRealName(e.target.value)} />
              <Input label="الاسم المستعار (يظهر للعملاء)" placeholder="الاسم المستعار" value={newAliasName} onChange={e => setNewAliasName(e.target.value)} />
              {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddModal(false); setEditSupplier(null); }}>إلغاء</Button>
              <Button className="flex-1" onClick={() => editSupplier ? handleEditSupplier() : handleAddSupplier()}><Plus className="w-4 h-4 ml-1.5" /> {editSupplier ? 'حفظ' : 'إضافة'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}