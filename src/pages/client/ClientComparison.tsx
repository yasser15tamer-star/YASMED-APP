import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { supabase } from '@/lib/supabase';
import { parseExcelFile, extractProductNames } from '@/lib/excel';
import { compareShortageWithSuppliers, type ComparisonResult } from '@/lib/arabicCompare';
import { useAuth } from '@/context/AuthContext';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, Search, ShoppingCart, Package, TrendingDown, Check, HelpCircle, Database, RotateCcw } from 'lucide-react';

type FilterStatus = 'all' | 'found' | 'similar' | 'not_found' | 'all_products';

// تحميل كتالوج الأصناف من دالة السيرفر (بالاسم المستعار فقط) على صفحات من 1000
async function fetchClientCatalog(pageSize = 1000) {
  let all: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .rpc('get_client_catalog')
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

// توحيد الاسم عشان نكتشف التكرار (همزات، تشكيل، أرقام عربي، مسافات)
const normKey = (s: string) =>
  (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, '')
    .trim();

// لكل اسم صنف: نسيب أعلى خصم بس (ولو الخصم متساوي، الأقل سعرًا)
function dedupeBest<T>(
  rows: T[],
  getName: (r: T) => string,
  getDiscount: (r: T) => number,
  getFinal: (r: T) => number
): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const k = normKey(getName(r));
    const cur = best.get(k);
    if (
      !cur ||
      getDiscount(r) > getDiscount(cur) ||
      (getDiscount(r) === getDiscount(cur) && getFinal(r) < getFinal(cur))
    ) {
      best.set(k, r);
    }
  }
  return Array.from(best.values());
}

interface ClientComparisonProps {
  onCartUpdate: () => void;
}

export function ClientComparison({ onCartUpdate }: ClientComparisonProps) {
  const { profile } = useAuth();
  const [shortageItems, setShortageItems] = useState<string[]>([]);
  const [results, setResults] = useState<ComparisonResult[] | null>(null);
  const [allSystemProducts, setAllSystemProducts] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');
  const [addingToCart, setAddingToCart] = useState<string | null>(null);

  // تخزين الكميات المحددة لكل صنف مؤقتاً قبل الإضافة
  const [itemQuantities, setItemQuantities] = useState<{ [key: string]: number }>({});

  // حالة لاقتراح استرجاع الملف السابق المخزن
  const [savedSession, setSavedSession] = useState<{ fileName: string; items: string[]; results: any[]; allProducts: any[] } | null>(null);

  const sessionKey = profile ? `last_comparison_session:${profile.id}` : null;

  // استرجاع جلسة الحساب الحالي فقط، وحذف النسخة القديمة المشتركة بين كل الحسابات
  useEffect(() => {
    localStorage.removeItem('last_comparison_session');
    if (!sessionKey) return;
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try {
        const parsedData = JSON.parse(saved);
        if (parsedData && parsedData.fileName && parsedData.items?.length > 0) {
          setSavedSession(parsedData);
        }
      } catch (e) {
        console.error('Error parsing saved session', e);
      }
    }
  }, [sessionKey]);

  const handleRestoreSession = () => {
    if (!savedSession) return;
    setFileName(savedSession.fileName);
    setShortageItems(savedSession.items);
    setResults(savedSession.results);
    setAllSystemProducts(savedSession.allProducts);
    setSavedSession(null);
    setSuccess(`تم استرجاع جلسة الملف "${savedSession.fileName}" بنجاح`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleClearSession = () => {
    if (sessionKey) localStorage.removeItem(sessionKey);
    setSavedSession(null);
  };

  const handleFileSelect = async (file: File) => {
    setLoading(true); setError(null); setResults(null); setAllSystemProducts(null);
    try {
      const parsed = await parseExcelFile(file);
      const items = extractProductNames(parsed);
      if (items.length === 0) { setError('لم يتم العثور على أسماء منتجات في الملف'); setLoading(false); return; }
      setShortageItems(items); setFileName(file.name);
      setSuccess(`تم قراءة ${items.length} صنف`); setTimeout(() => setSuccess(null), 3000);
    } catch { setError('فشل في قراءة الملف'); }
    setLoading(false);
  };

  const handleCompare = async () => {
    if (shortageItems.length === 0) return;
    setLoading(true); setError(null);

    try {
      if (!profile?.business_type) {
        setError('حسابك غير مرتبط بنوع مخزن، يرجى التواصل مع الإدارة');
        return;
      }

      // الكتالوج جاهز من السيرفر: بالاسم المستعار فقط وبنوع حساب العميل فقط
      const rawProducts = await fetchClientCatalog();

      const supplierProducts = rawProducts.map((p: any) => {
        const price = Number(p.price ?? 0);
        const discount = Number(p.discount ?? 0);
        let finalPrice = Number(p.final_price ?? 0);
        if (!finalPrice && price > 0) finalPrice = price - price * (discount / 100);

        return {
          product_name: p.product_name || '',
          supplier_id: p.supplier_id,
          supplier_alias: (p.supplier_alias || 'مخزن').trim(),
          price,
          discount,
          final_price: finalPrice,
          quantity: Number(p.quantity ?? 0),
        };
      });

      if (supplierProducts.length === 0) {
        setError(`لا توجد أصناف متاحة لنوع حسابك ("${profile.business_type}"). تأكد من الإدارة أن شيتات الموردين محفوظة بنفس النوع.`);
        return;
      }

      // المقارنة، ثم إزالة التكرار (أعلى خصم لكل صنف)
      const rawResults = compareShortageWithSuppliers(shortageItems, supplierProducts);
      const comparisonResults = rawResults.map(r => ({
        ...r,
        matches: dedupeBest(r.matches, m => m.productName, m => m.discount, m => m.finalPrice),
      }));
      const uniqueProducts = dedupeBest(supplierProducts, p => p.product_name, p => p.discount, p => p.final_price);

      setResults(comparisonResults);
      setAllSystemProducts(uniqueProducts);

      // حفظ الجلسة في localStorage لعدم فقدانها عند التنقل
      if (sessionKey) localStorage.setItem(sessionKey, JSON.stringify({
        fileName,
        items: shortageItems,
        results: comparisonResults,
        allProducts: uniqueProducts,
      }));

      if (profile) {
        await supabase.from('comparison_sessions').insert({
          client_id: profile.id,
          file_name: fileName,
          item_count: shortageItems.length,
          results: JSON.stringify(comparisonResults),
        });
      }

      setSuccess(`تمت المقارنة بنجاح. عدد النتائج: ${comparisonResults.length}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      console.error('Comparison fetch error:', err);
      setError(`فشل في تحميل أصناف الموردين: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (key: string, qty: number) => {
    setItemQuantities(prev => ({ ...prev, [key]: Math.max(1, qty) }));
  };

  const handleAddToCartGeneric = async (product: { productName: string; supplierAlias: string; supplierId: any; price: number; discount: number; finalPrice: number }) => {
    if (!profile) return;
    const uniqueKey = product.productName + product.supplierAlias;
    const qty = itemQuantities[uniqueKey] || 1;

    setAddingToCart(uniqueKey);
    const { error } = await supabase.from('cart_items').insert({
      client_id: profile.id,
      supplier_id: product.supplierId,
      product_name: product.productName,
      supplier_alias: product.supplierAlias,
      price: product.price,
      discount: product.discount,
      final_price: product.finalPrice,
      quantity: qty,
      status: 'active',
    });

    if (error) setError('فشل في إضافة المنتج إلى السلة');
    else {
      setSuccess(`تمت إضافة ${qty} قطعة إلى السلة بنجاح`);
      setTimeout(() => setSuccess(null), 2000);
      onCartUpdate();
    }
    setAddingToCart(null);
  };

  const filteredResults = results?.filter(r => {
    if (filter === 'all_products') return true;
    if (filter !== 'all' && r.status !== filter) return false;
    if (search && !r.shortageItem.includes(search)) return false;
    return true;
  });

  const filteredAllProducts = allSystemProducts?.filter(p => {
    if (!search) return true;
    return p.product_name?.toLowerCase().includes(search.toLowerCase()) || p.supplier_alias?.toLowerCase().includes(search.toLowerCase());
  });

  const statusCounts = results ? {
    all: results.length,
    found: results.filter(r => r.status === 'found').length,
    similar: results.filter(r => r.status === 'similar').length,
    not_found: results.filter(r => r.status === 'not_found').length,
    all_products: allSystemProducts ? allSystemProducts.length : 0,
  } : null;

  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mb-4 sm:mb-6">مركز مقارنة الموردين</h2>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {success}</div>}

      {/* تنبيه استرجاع الجلسة السابقة */}
      {savedSession && !results && (
        <div className="mb-6 p-4 rounded-2xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-800">هل تريد الرجوع لملفك السابق؟</p>
              <p className="text-xs text-slate-500">لديك جلسة محفوظة للملف: <span className="font-semibold text-teal-700">{savedSession.fileName}</span> ({savedSession.items.length} صنف)</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button size="sm" variant="outline" onClick={handleClearSession} className="flex-1 sm:flex-none">تجاهل</Button>
            <Button size="sm" onClick={handleRestoreSession} className="flex-1 sm:flex-none bg-teal-600 hover:bg-teal-700 text-white">استرجاع الملف السابق</Button>
          </div>
        </div>
      )}

      {!results ? (
        <Card><CardBody className="p-4 sm:p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-50 mb-4"><FileSpreadsheet className="w-8 h-8 text-teal-600" /></div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">رفع ملف النواقص</h3>
            <p className="text-sm text-slate-500">ارفع ملف Excel الخاص بشركتك لبدء المقارنة</p>
          </div>
          {!shortageItems.length ? (
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 sm:p-10 text-center hover:border-teal-400 transition-colors cursor-pointer" onClick={() => document.getElementById('client-file-input')?.click()}>
              {loading ? <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-3" /> : <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />}
              <p className="text-slate-600 font-medium mb-1">اضغط لرفع ملف Excel</p>
              <p className="text-xs text-slate-400">يدعم .xlsx, .xls, .csv</p>
              <input id="client-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">تم قراءة {shortageItems.length} صنف من {fileName}</span>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-100 mb-6">
                <ul className="divide-y divide-slate-50">
                  {shortageItems.slice(0, 20).map((item, i) => (
                    <li key={i} className="px-4 py-2.5 text-sm text-slate-700 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span>{item}</li>
                  ))}
                  {shortageItems.length > 20 && <li className="px-4 py-2.5 text-xs text-slate-400 text-center">و {shortageItems.length - 20} صنف آخر...</li>}
                </ul>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => { setShortageItems([]); setFileName(''); }}>تغيير الملفات</Button>
                <Button size="lg" className="flex-1" onClick={handleCompare} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} بدء المقارنة الشاملة</Button>
              </div>
            </div>
          )}
        </CardBody></Card>
      ) : (
        <div>
          <CollapsibleSection title="ملخص النتائج" className="mb-4">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="px-3 sm:px-4 py-2 rounded-xl bg-white border border-slate-100 flex items-center gap-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm font-semibold text-slate-700">{statusCounts?.all} صنف</span></div>
            <div className="px-3 sm:px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /><span className="text-sm font-semibold text-emerald-700">{statusCounts?.found} موجود</span></div>
            <div className="px-3 sm:px-4 py-2 rounded-xl bg-amber-50 border border-amber-100 flex items-center gap-2"><HelpCircle className="w-4 h-4 text-amber-600" /><span className="text-sm font-semibold text-amber-700">{statusCounts?.similar} متشابه</span></div>
            <div className="px-3 sm:px-4 py-2 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-red-600" /><span className="text-sm font-semibold text-red-700">{statusCounts?.not_found} غير موجود</span></div>
            <div className="px-3 sm:px-4 py-2 rounded-xl bg-teal-50 border border-teal-100 flex items-center gap-2 cursor-pointer" onClick={() => setFilter('all_products')}><Database className="w-4 h-4 text-teal-600" /><span className="text-sm font-semibold text-teal-700">كل أصناف النظام ({statusCounts?.all_products})</span></div>
          </div>
          </CollapsibleSection>

          <CollapsibleSection title="الفلترة والبحث" className="mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-wrap gap-1 p-1 bg-white rounded-xl border border-slate-100">
              {([
                { key: 'all', label: 'الكل' },
                { key: 'found', label: 'موجود' },
                { key: 'similar', label: 'متشابه' },
                { key: 'not_found', label: 'غير موجود' },
                { key: 'all_products', label: 'كل أصناف النظام' },
              ] as { key: FilterStatus; label: string }[]).map(f => (
                <button key={f.key} onClick={() => setFilter(f.key)} className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${filter === f.key ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>{f.label}</button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" placeholder="بحث في الأصناف أو الموردين..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pr-10 pl-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
            </div>
          </div>
          </CollapsibleSection>

          <CollapsibleSection title={filter === 'all_products' ? 'جميع أصناف الموردين المتاحة' : 'نتائج المقارنة'} className="mb-4">
          {filter === 'all_products' ? (
            <div className="space-y-3">
              <h3 className="text-lg font-bold text-slate-800 mb-2">جميع أصناف الموردين المتاحة في النظام:</h3>
              {filteredAllProducts?.map((product, idx) => {
                const uniqueKey = product.product_name + product.supplier_alias;
                const currentQty = itemQuantities[uniqueKey] || 1;
                return (
                  <Card key={idx}>
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800">{product.product_name}</p>
                        <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-teal-700 font-bold">المورد: {product.supplier_alias}</span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">السعر: {product.price} ج.م</span>
                          {product.discount > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600">خصم {product.discount}%</span>}
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold">النهائي: {product.final_price.toFixed(2)} ج.م</span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">المتاح بالمخزن: {product.quantity}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                          <span className="px-2 text-xs text-slate-400 bg-slate-50 py-2">الكمية</span>
                          <input
                            type="number"
                            min="1"
                            value={currentQty}
                            onChange={e => handleQuantityChange(uniqueKey, parseInt(e.target.value) || 1)}
                            className="w-16 text-center py-1.5 text-sm font-bold text-slate-800 focus:outline-none"
                          />
                        </div>
                        <Button size="sm" variant="success" disabled={addingToCart === uniqueKey} onClick={() => handleAddToCartGeneric({ productName: product.product_name, supplierAlias: product.supplier_alias, supplierId: product.supplier_id, price: product.price, discount: product.discount, finalPrice: product.final_price })}>
                          {addingToCart === uniqueKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                          إضافة للسلة
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults?.map((result, idx) => (
                <Card key={idx}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${result.status === 'found' ? 'bg-emerald-50' : result.status === 'similar' ? 'bg-amber-50' : 'bg-red-50'}`}>
                          {result.status === 'found' ? <Check className="w-5 h-5 text-emerald-600" /> : result.status === 'similar' ? <HelpCircle className="w-5 h-5 text-amber-600" /> : <TrendingDown className="w-5 h-5 text-red-600" />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{result.shortageItem}</p>
                          <Badge status={result.status} className="mt-1">{result.status === 'found' ? 'موجود' : result.status === 'similar' ? 'متشابه' : 'غير موجود'}</Badge>
                        </div>
                      </div>
                    </div>
                    {result.matches.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {result.matches.map((match, mIdx) => {
                          const uniqueKey = match.productName + match.supplierAlias;
                          const currentQty = itemQuantities[uniqueKey] || 1;
                          return (
                            <div key={mIdx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-700 truncate">{match.productName}</p>
                                <div className="flex flex-wrap gap-2 mt-1.5 text-xs">
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-teal-700 font-bold">المورد: {match.supplierAlias}</span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">السعر: {match.price} ج.م</span>
                                  {match.discount > 0 && <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-600">خصم {match.discount}%</span>}
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-600 font-semibold">النهائي: {match.finalPrice.toFixed(2)} ج.م</span>
                                  <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">المتاح: {match.quantity}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                                  <span className="px-2 text-xs text-slate-400 bg-slate-50 py-2">الكمية</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={currentQty}
                                    onChange={e => handleQuantityChange(uniqueKey, parseInt(e.target.value) || 1)}
                                    className="w-16 text-center py-1.5 text-sm font-bold text-slate-800 focus:outline-none"
                                  />
                                </div>
                                <Button size="sm" variant={result.status === 'not_found' ? 'outline' : 'success'} disabled={addingToCart === uniqueKey} onClick={() => handleAddToCartGeneric({ productName: match.productName, supplierAlias: match.supplierAlias, supplierId: match.supplierId, price: match.price, discount: match.discount, finalPrice: match.finalPrice })}>
                                  {addingToCart === uniqueKey ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingCart className="w-3.5 h-3.5" />}
                                  إضافة للسلة
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
          </CollapsibleSection>

          <div className="mt-4 flex gap-3">
            <Button variant="outline" onClick={() => { setResults(null); setShortageItems([]); setFileName(''); setAllSystemProducts(null); handleClearSession(); }}>مقارنة جديدة بالكامل</Button>
          </div>
        </div>
      )}
    </div>
  );
}