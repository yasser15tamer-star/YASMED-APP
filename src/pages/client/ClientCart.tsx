import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/Badge';
import { supabase, type CartItem, type Order } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  ShoppingCart, Trash2, AlertCircle, CheckCircle2, Loader2, Minus, Plus,
  CheckSquare, Square, Tag, Store, PackageCheck, ReceiptText, Sparkles, Pill, ShieldCheck, CalendarDays, Clock, ChevronDown, XCircle,
} from 'lucide-react';

interface ClientCartProps {
  onCartUpdate: () => void;
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* خانة الكمية: بتكتب في نسخة محلية، وبتتثبّت لما تسيب الخانة أو تضغط Enter */
function QtyInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  const commit = () => {
    const n = parseInt(draft, 10);
    const valid = Number.isFinite(n) && n >= 1 ? n : value;
    setDraft(String(valid));
    if (valid !== value) onCommit(valid);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={draft}
      onFocus={e => { setFocused(true); e.target.select(); }}
      onChange={e => {
        const latin = e.target.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632));
        setDraft(latin.replace(/\D/g, ''));
      }}
      onBlur={() => { setFocused(false); commit(); }}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-14 bg-transparent text-center text-base font-extrabold tabular-nums text-slate-900 focus:outline-none"
      aria-label="الكمية"
    />
  );
}

export function ClientCart({ onCartUpdate }: ClientCartProps) {
  const { profile } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [openOrders, setOpenOrders] = useState<string[]>([]);
  const toggleOrder = (key: string) =>
    setOpenOrders(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  const [confirmCancelKey, setConfirmCancelKey] = useState<string | null>(null);
  const [cancellingKey, setCancellingKey] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  /* silent = تحديث في الخلفية من غير ما نخفي القايمة (عشان الخانة متفقدش التركيز) */
  const fetchCart = useCallback(async (silent = false) => {
    if (!profile) return;
    if (!silent) setLoading(true);
    const { data, error } = await supabase.from('cart_items').select('*').eq('client_id', profile.id).eq('status', 'active').order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل السلة');
    else {
      const rows = data || [];
      setCartItems(rows);
      setSelectedItemIds(prev => prev.filter(id => rows.some(r => r.id === id)));
    }

    const { data: orderData } = await supabase.from('orders').select('*').eq('client_id', profile.id).order('created_at', { ascending: false });
    setOrders(orderData || []);
    if (!silent) setLoading(false);
  }, [profile]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const handleToggleSelectAll = () => {
    if (selectedItemIds.length === cartItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(cartItems.map(item => item.id));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleRemove = async (id: string) => {
    const { error } = await supabase.from('cart_items').delete().eq('id', id);
    if (error) setError('فشل في الحذف');
    else { fetchCart(true); onCartUpdate(); }
  };

  const handleRemoveSelected = async () => {
    if (selectedItemIds.length === 0) return;
    const { error } = await supabase.from('cart_items').delete().in('id', selectedItemIds);
    if (error) setError('فشل في حذف الأصناف المحددة');
    else {
      setSuccess('تم حذف الأصناف المحددة بنجاح');
      setTimeout(() => setSuccess(null), 3000);
      fetchCart(true);
      onCartUpdate();
    }
  };

  const handleClearCart = async () => {
    if (!profile || cartItems.length === 0) return;
    const { error } = await supabase.from('cart_items').delete().eq('client_id', profile.id).eq('status', 'active');
    if (error) setError('فشل في تفريغ السلة');
    else {
      setSuccess('تم تفريغ السلة بالكامل');
      setTimeout(() => setSuccess(null), 3000);
      fetchCart(true);
      onCartUpdate();
    }
  };

  /* تحديث الكمية: بيتغير على الشاشة فوراً، وبعدين بيتحفظ في الخلفية من غير إعادة تحميل */
  const handleUpdateQty = async (id: string, qty: number) => {
    const validQty = Math.max(1, qty);
    setCartItems(prev => prev.map(i => (i.id === id ? { ...i, quantity: validQty } : i)));
    const { error } = await supabase.from('cart_items').update({ quantity: validQty }).eq('id', id);
    if (error) {
      setError('فشل في تحديث الكمية');
      fetchCart(true);
    } else {
      onCartUpdate();
    }
  };

  const handlePlaceOrder = async () => {
    if (!profile || cartItems.length === 0) return;
    setPlacingOrder(true); setError(null);

    const orderRows = cartItems.map(item => ({
      client_id: profile.id,
      client_name: profile.full_name,
      client_business_type: profile.business_type,
      client_province: profile.province,
      client_city: profile.city,
      client_address: profile.detailed_address,
      client_license_number: profile.license_number,
      client_tax_number: profile.tax_number,
      client_commercial_record: profile.commercial_record,
      client_contact_numbers: profile.contact_numbers,
      product_name: item.product_name,
      supplier_id: item.supplier_id,
      supplier_real_name: '',
      supplier_alias: item.supplier_alias,
      price: item.price,
      discount: item.discount,
      final_price: item.final_price,
      quantity: item.quantity,
      status: 'pending',
    }));

    const { error: orderError } = await supabase.from('orders').insert(orderRows);
    if (orderError) { setError('فشل في إنشاء الطلب'); setPlacingOrder(false); return; }

    const { error: cartError } = await supabase.from('cart_items').update({ status: 'ordered' }).eq('client_id', profile.id).eq('status', 'active');
    if (cartError) { setError('فشل في تحديث السلة'); }

    setSuccess('تم إنشاء الطلب بنجاح!');
    setTimeout(() => setSuccess(null), 3000);
    fetchCart(true); onCartUpdate();
    setPlacingOrder(false);
  };

  /* إلغاء طلب: بيلغي الأصناف اللي لسه "قيد الانتظار" بس */
  const handleCancelOrder = async (key: string, ids: string[]) => {
    if (!profile || ids.length === 0) return;
    setCancellingKey(key); setCancelError(null);
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .in('id', ids)
      .eq('client_id', profile.id)
      .eq('status', 'pending')
      .select('id');
    if (error || !data || data.length === 0) {
      setCancelError('تعذّر إلغاء الطلب، ممكن الإدارة بدأت تتعامل معاه');
    } else {
      setConfirmCancelKey(null);
      await fetchCart(true);
    }
    setCancellingKey(null);
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + item.final_price * item.quantity, 0);
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const beforeDiscount = cartItems.reduce((sum, item) => sum + (item.price ?? item.final_price) * item.quantity, 0);
  const savings = Math.max(0, beforeDiscount - cartTotal);
  const allSelected = cartItems.length > 0 && selectedItemIds.length === cartItems.length;

  const statusLabels: Record<string, string> = {
    pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي',
  };
  const statusBadgeMap: Record<string, 'found' | 'similar' | 'not_found' | 'default'> = {
    pending: 'similar', processing: 'default', completed: 'found', cancelled: 'not_found',
  };

  /* تجميع الطلبات: كل أصناف نفس عملية التأكيد (نفس وقت الإنشاء) بتتحط في طلب واحد */
  const orderGroups = (() => {
    const map = new Map<string, Order[]>();
    orders.forEach(o => {
      const list = map.get(o.created_at) || [];
      list.push(o);
      map.set(o.created_at, list);
    });
    const oldestFirst = Array.from(map.entries()).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
    return oldestFirst
      .map(([createdAt, items], idx) => {
        const statuses = items.map(i => i.status);
        const groupStatus =
          statuses.every(st => st === 'cancelled') ? 'cancelled'
          : statuses.every(st => st === 'completed' || st === 'cancelled') ? 'completed'
          : statuses.some(st => st === 'processing' || st === 'completed') ? 'processing'
          : 'pending';
        return {
          createdAt,
          number: idx + 1,
          items,
          groupStatus,
          total: items.reduce((sum, i) => sum + i.final_price * i.quantity, 0),
          qty: items.reduce((sum, i) => sum + i.quantity, 0),
        };
      })
      .reverse();
  })();

  const confirmButton = () => (
    <button
      onClick={handlePlaceOrder}
      disabled={placingOrder}
      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-blue-600 to-blue-800 py-4 text-base font-extrabold text-white shadow-lg shadow-blue-700/30 transition hover:shadow-xl hover:shadow-blue-700/40 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex items-center justify-center gap-2">
        {placingOrder ? <Loader2 className="h-5 w-5 animate-spin" /> : <PackageCheck className="h-5 w-5" />}
        تأكيد الطلب
      </span>
    </button>
  );

  return (
    <div className="pb-32 lg:pb-0">
      {/* ===== العنوان ===== */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-50">
            <ShoppingCart className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">السلة</h2>
            <p className="mt-0.5 text-sm text-slate-500">راجع أصنافك وكمياتك قبل تأكيد الطلب</p>
          </div>
        </div>
        {cartItems.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-bold text-slate-700 shadow-sm">
              {cartItems.length} صنف
            </span>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-700">
              {totalQty} قطعة
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : cartItems.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50 px-6 py-20 text-center">
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 ring-8 ring-blue-50/50">
            <ShoppingCart className="h-10 w-10 text-blue-500" />
          </div>
          <p className="text-xl font-extrabold text-slate-800">السلة فارغة</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            ابدأ من «مركز مقارنة الموردين» وأضف الأصناف اللي عايزها، وهتظهر هنا جاهزة للطلب.
          </p>
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">

          {/* ===== الأصناف ===== */}
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <button onClick={handleToggleSelectAll} className="flex items-center gap-2.5 text-sm font-bold text-slate-700 transition hover:text-blue-700">
                {allSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5 text-slate-400" />}
                تحديد الكل ({cartItems.length})
              </button>
              <div className="flex items-center gap-2">
                {selectedItemIds.length > 0 && (
                  <button onClick={handleRemoveSelected} className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100">
                    حذف المحدد ({selectedItemIds.length})
                  </button>
                )}
                <button onClick={handleClearCart} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">
                  حذف السلة كلياً
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {cartItems.map(item => {
                const isSelected = selectedItemIds.includes(item.id);
                const lineTotal = item.final_price * item.quantity;
                return (
                  <div
                    key={item.id}
                    className={`group relative overflow-hidden rounded-2xl border bg-white p-4 transition-all duration-200 sm:p-5 ${
                      isSelected
                        ? 'border-blue-500 shadow-lg shadow-blue-500/10 ring-4 ring-blue-50'
                        : 'border-slate-200 shadow-sm hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70'
                    }`}
                  >
                    <span className={`absolute inset-y-0 right-0 w-1 transition ${isSelected ? 'bg-blue-600' : 'bg-transparent group-hover:bg-blue-200'}`} />

                    <div className="flex items-start gap-3 sm:gap-4">
                      <button onClick={() => handleToggleSelectItem(item.id)} className="mt-3 shrink-0 text-slate-300 transition hover:text-blue-600" aria-label="تحديد">
                        {isSelected ? <CheckSquare className="h-5 w-5 text-blue-600" /> : <Square className="h-5 w-5" />}
                      </button>

                      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:flex">
                        <Pill className="h-6 w-6" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-base font-extrabold leading-snug text-slate-900 sm:text-lg">{item.product_name}</p>
                          <button onClick={() => handleRemove(item.id)} className="shrink-0 rounded-xl p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500" aria-label="حذف">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            <Store className="h-3.5 w-3.5" /> {item.supplier_alias}
                          </span>
                          {item.discount > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-extrabold text-amber-700 ring-1 ring-amber-200">
                              <Tag className="h-3.5 w-3.5" /> خصم {item.discount}%
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
                          {/* الكمية */}
                          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
                            <button onClick={() => handleUpdateQty(item.id, item.quantity + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-blue-600 hover:text-white" aria-label="زيادة"><Plus className="h-4 w-4" /></button>
                            <QtyInput value={item.quantity} onCommit={n => handleUpdateQty(item.id, n)} />
                            <button onClick={() => handleUpdateQty(item.id, item.quantity - 1)} disabled={item.quantity <= 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm transition hover:bg-blue-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-700" aria-label="نقصان"><Minus className="h-4 w-4" /></button>
                          </div>

                          {/* الأسعار */}
                          <div className="text-left">
                            <p className="flex items-baseline justify-end gap-1.5 text-xs text-slate-500">
                              {item.discount > 0 && item.price > item.final_price && (
                                <span dir="ltr" className="tabular-nums text-slate-400 line-through">{fmt(item.price)}</span>
                              )}
                              <span dir="ltr" className="font-bold tabular-nums text-slate-600">{fmt(item.final_price)}</span>
                              <span>ج.م للقطعة</span>
                            </p>
                            <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-blue-700">{fmt(lineTotal)} <span className="text-sm font-bold text-blue-500">ج.م</span></p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== ملخص الطلب (ثابت على الكمبيوتر) ===== */}
          <aside className="hidden lg:sticky lg:top-6 lg:block">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/70">
              <div className="relative overflow-hidden bg-gradient-to-br from-[#0b1d3d] to-[#16356b] px-6 py-5 text-white">
                <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/10" />
                <div className="relative flex items-center gap-2.5 text-base font-extrabold"><ReceiptText className="h-5 w-5 text-blue-300" /> ملخص الطلب</div>
                <p className="relative mt-1 text-xs text-blue-200">{cartItems.length} صنف · {totalQty} قطعة</p>
              </div>
              <div className="space-y-3.5 p-6 text-sm">
                <div className="flex justify-between text-slate-600"><span>عدد الأصناف</span><b className="text-slate-900">{cartItems.length}</b></div>
                <div className="flex justify-between text-slate-600"><span>إجمالي القطع</span><b className="text-slate-900">{totalQty}</b></div>
                {savings > 0 && (
                  <>
                    <div className="flex justify-between text-slate-600"><span>قبل الخصم</span><b className="tabular-nums text-slate-400 line-through">{fmt(beforeDiscount)} ج.م</b></div>
                    <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700 ring-1 ring-emerald-100">
                      <span className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4" /> وفّرت</span>
                      <b className="tabular-nums">{fmt(savings)} ج.م</b>
                    </div>
                  </>
                )}
                <div className="border-t border-dashed border-slate-200 pt-5">
                  <p className="text-xs font-semibold text-slate-500">الإجمالي الكلي</p>
                  <p className="mt-1 text-4xl font-extrabold tabular-nums text-slate-900">{fmt(cartTotal)} <span className="text-base font-bold text-slate-500">ج.م</span></p>
                </div>
                {confirmButton()}
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> سيتم إرسال الطلب للإدارة للمراجعة
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ===== شريط سفلي ثابت للموبايل ===== */}
      {!loading && cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-slate-200 bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_32px_-10px_rgba(11,29,61,.3)] backdrop-blur lg:hidden">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">الإجمالي الكلي</p>
              <p className="text-2xl font-extrabold tabular-nums text-slate-900">{fmt(cartTotal)} <span className="text-sm text-slate-500">ج.م</span></p>
            </div>
            {savings > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">وفّرت {fmt(savings)} ج.م</span>}
          </div>
          {confirmButton()}
        </div>
      )}

      {/* ===== الطلبات السابقة (كل طلب بطاقة تتفتح وتتقفل) ===== */}
      {orderGroups.length > 0 && (
        <div className="mt-12">
          <h3 className="mb-5 flex items-center gap-2.5 text-lg font-extrabold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><ReceiptText className="h-5 w-5" /></span>
            طلباتي السابقة
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-500">{orderGroups.length}</span>
          </h3>
          <div className="space-y-4">
            {orderGroups.map(group => {
              const d = new Date(group.createdAt);
              const isOpen = openOrders.includes(group.createdAt);
              const pendingIds = group.items.filter(i => i.status === 'pending').map(i => i.id);
              const confirming = confirmCancelKey === group.createdAt;
              const cancelled = group.groupStatus === 'cancelled';
              return (
                <div
                  key={group.createdAt}
                  className={`overflow-hidden rounded-3xl border bg-white transition-all duration-200 ${isOpen ? 'border-blue-300 shadow-lg shadow-blue-500/10' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}
                >
                  {/* ===== الملخص (ظاهر دايماً) ===== */}
                  <button
                    type="button"
                    onClick={() => toggleOrder(group.createdAt)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-4 text-right transition hover:bg-slate-50/70 sm:gap-4 sm:px-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-md shadow-blue-600/25">
                      <ReceiptText className="h-5 w-5" />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-base font-extrabold text-slate-900">
                          طلب رقم <span dir="ltr" className="inline-block tabular-nums text-blue-700">#{String(group.number).padStart(4, '0')}</span>
                        </span>
                        <Badge status={statusBadgeMap[group.groupStatus]}>{statusLabels[group.groupStatus]}</Badge>
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {d.toLocaleDateString('ar-EG')}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                        <span className="font-semibold text-slate-600">{group.items.length} صنف · {group.qty} قطعة</span>
                      </span>
                    </span>

                    <span className="shrink-0 text-left">
                      <span className="block text-[11px] font-semibold text-slate-400">إجمالي الطلب</span>
                      <span className={`block text-lg font-extrabold tabular-nums sm:text-xl ${cancelled ? 'text-slate-400 line-through' : 'text-blue-700'}`}>{fmt(group.total)} <span className="text-xs font-bold text-blue-500">ج.م</span></span>
                    </span>

                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${isOpen ? 'rotate-180 border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                      <ChevronDown className="h-5 w-5" />
                    </span>
                  </button>

                  {/* ===== التفاصيل (بتتفتح وتتقفل) ===== */}
                  <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="divide-y divide-slate-100 border-t border-slate-100">
                        {group.items.map(order => (
                          <div key={order.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Pill className="h-5 w-5" /></div>
                              <div className="min-w-0">
                                <p className="text-sm font-extrabold leading-snug text-slate-900">{order.product_name}</p>
                                <p className="mt-1 text-xs text-slate-500">المورد: {order.supplier_alias} · الكمية: {order.quantity}</p>
                              </div>
                            </div>
                            <div className="shrink-0 text-left">
                              <p className="text-sm font-extrabold tabular-nums text-slate-900">{fmt(order.final_price * order.quantity)} ج.م</p>
                              <p dir="ltr" className="mt-0.5 text-[11px] tabular-nums text-slate-400">{fmt(order.final_price)} × {order.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {pendingIds.length > 0 && (
                        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                          {confirming ? (
                            <div className="space-y-3">
                              <p className="flex items-center gap-2 text-sm font-bold text-red-700">
                                <AlertCircle className="h-4 w-4 shrink-0" /> متأكد إنك عايز تلغي الطلب ده؟
                              </p>
                              {cancelError && <p className="text-xs font-semibold text-red-600">{cancelError}</p>}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCancelOrder(group.createdAt, pendingIds)}
                                  disabled={cancellingKey === group.createdAt}
                                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-extrabold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 disabled:opacity-60 sm:flex-none sm:px-6"
                                >
                                  {cancellingKey === group.createdAt ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                                  نعم، إلغاء الطلب
                                </button>
                                <button
                                  onClick={() => { setConfirmCancelKey(null); setCancelError(null); }}
                                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100"
                                >
                                  رجوع
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">تقدر تلغي الطلب طالما هو قيد الانتظار</p>
                              <button
                                onClick={() => { setConfirmCancelKey(group.createdAt); setCancelError(null); }}
                                className="flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" /> إلغاء الطلب
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}