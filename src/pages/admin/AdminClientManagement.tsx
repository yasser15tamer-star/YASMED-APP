import { useEffect, useState, useCallback } from 'react';
import { supabase, type Profile } from '@/lib/supabase';
import {
  Loader2, Users, Search, UserCheck, UserX, Clock, Building2, Store, CheckCircle2, Eye, Trash2,
  FileText, X, ShieldAlert, Phone, MapPin, Mail, CalendarDays, XCircle, BadgeCheck,
} from 'lucide-react';

type Filter = 'all' | 'pending' | 'active';

export function AdminClientManagement() {
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // حالة نافذة المعاينة التفصيلية
  const [selectedClient, setSelectedClient] = useState<Profile | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').eq('role', 'client').order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل العملاء');
    else setClients(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const updateClientStatus = async (clientId: string, enabled: boolean) => {
    const { error } = await supabase.rpc('admin_set_client_enabled', { p_client_id: clientId, p_enabled: enabled });
    if (error) {
      setError('فشل في تحديث حالة العميل');
    } else {
      fetchClients();
      if (selectedClient?.id === clientId) {
        setSelectedClient(prev => prev ? { ...prev, enabled } : null);
      }
    }
  };

  const handleRejectClient = async (clientId: string) => {
    if (!window.confirm('هل أنت متأكد من رفض وحذف هذا الطلب نهائياً؟ لن يتمكن صاحبه من استخدام هذا الحساب مرة أخرى.')) return;
    setRejectingId(clientId);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/delete-client`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ client_id: clientId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setError(result?.error || 'فشل في رفض وحذف الحساب');
        return;
      }
      setClients(prev => prev.filter(c => c.id !== clientId));
      setIsViewModalOpen(false);
      setSelectedClient(null);
    } catch {
      setError('فشل في رفض وحذف الحساب');
    } finally {
      setRejectingId(null);
    }
  };

  const activeCount = clients.filter(c => c.enabled).length;
  const pendingCount = clients.filter(c => !c.enabled).length;

  const filteredClients = clients
    .filter(c => (filter === 'all' ? true : filter === 'active' ? c.enabled : !c.enabled))
    .filter(c => (search ? c.full_name?.toLowerCase().includes(search.toLowerCase()) : true));

  const openDetailsModal = (client: Profile) => {
    setSelectedClient(client);
    setIsViewModalOpen(true);
  };

  // دالة مساعدة لاستخراج البيانات من كافة الأماكن المحتملة (حقول مباشرة، أو metadata، أو تحليل النص القديم)
  const getClientDetailsMeta = (client: Profile) => {
    const rawName = client.full_name || '';
    let typeText = 'نشاط تجاري';
    let cleanName = rawName;

    const metaData = (client as any).raw_user_meta_data || (client as any).user_metadata || {};

    if (rawName.includes('مخزن جملة') || metaData.businessType === 'wholesale_warehouse') typeText = 'مخزن جملة';
    else if (rawName.includes('مخزن قطاعي') || metaData.businessType === 'retail_warehouse') typeText = 'مخزن قطاعي';
    else if (rawName.includes('صيدلية') || metaData.businessType === 'pharmacy') typeText = 'صيدلية';

    if (rawName.includes('[')) {
      cleanName = rawName.split('[')[0].trim();
    }
    if (metaData.storeName) {
      cleanName = metaData.storeName;
    }

    // استخراج أرقام الترخيص والضرائب والسجل من الحقول أو الـ metadata أو النص القديم
    const licenseNumber = metaData.licenseNumber || (client as any).license_number || (rawName.match(/ترخيص:\s*([^\\]+)]/) ? rawName.match(/ترخيص:\s*([^\\]+)]/)?.[1] : null) || 'غير متوفر';
    const taxNumber = metaData.taxNumber || (client as any).tax_number || 'غير متوفر';
    const commercialRecord = metaData.commercialRecord || (client as any).commercial_record || 'غير متوفر';

    return { typeText, cleanName, licenseNumber, taxNumber, commercialRecord };
  };

  const TypeIcon = ({ type, className }: { type: string; className?: string }) =>
    type.includes('جملة') ? <Building2 className={className} /> : type.includes('صيدلية') ? <CheckCircle2 className={className} /> : <Store className={className} />;

  const DocChip = ({ label, value }: { label: string; value: string }) => {
    const ok = value !== 'غير متوفر';
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${ok ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100' : 'bg-red-50 text-red-600 ring-1 ring-red-100'}`}>
        {ok ? <BadgeCheck className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />} {label}
      </span>
    );
  };

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'الكل', count: clients.length },
    { id: 'pending', label: 'قيد المراجعة', count: pendingCount },
    { id: 'active', label: 'مفعّل', count: activeCount },
  ];

  const modalMeta = selectedClient ? getClientDetailsMeta(selectedClient) : null;

  return (
    <div className="space-y-6 text-right" dir="rtl">

      {/* ===== نافذة معاينة التفاصيل الكاملة ===== */}
      {isViewModalOpen && selectedClient && modalMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsViewModalOpen(false)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white text-right shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* الهيدر */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0b1d3d] to-[#16356b] px-6 pb-7 pt-6 text-white sm:px-8">
              <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
              <div className="pointer-events-none absolute -bottom-12 right-20 h-28 w-28 rounded-full bg-blue-400/10" />
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="absolute left-4 top-4 rounded-full bg-white/10 p-2 text-white ring-1 ring-white/20 transition hover:bg-white/20"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="relative flex items-center gap-4">
                <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-extrabold text-white shadow-lg ring-4 ${selectedClient.enabled ? 'bg-emerald-500 ring-emerald-400/30' : 'bg-amber-500 ring-amber-400/30'}`}>
                  {modalMeta.cleanName.charAt(0) || '؟'}
                </div>
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-extrabold sm:text-2xl">{modalMeta.cleanName}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold ring-1 ring-white/20">
                      <TypeIcon type={modalMeta.typeText} className="h-3.5 w-3.5" /> {modalMeta.typeText}
                    </span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${selectedClient.enabled ? 'bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-300/30' : 'bg-amber-400/20 text-amber-200 ring-1 ring-amber-300/30'}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {selectedClient.enabled ? 'حساب مفعل' : 'بانتظار مراجعة الإدارة'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              {/* المستندات */}
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><FileText className="h-4 w-4" /></span>
                  المستندات والبيانات القانونية
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'رقم الترخيص', value: modalMeta.licenseNumber },
                    { label: 'الرقم الضريبي', value: modalMeta.taxNumber },
                    { label: 'رقم السجل التجاري', value: modalMeta.commercialRecord },
                  ].map(doc => {
                    const ok = doc.value !== 'غير متوفر';
                    return (
                      <div key={doc.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                          {ok ? <BadgeCheck className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-slate-500">{doc.label}</p>
                          <p className={`font-mono text-base font-extrabold tracking-wider ${ok ? 'text-slate-900' : 'text-red-500'}`}>{doc.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* بيانات التواصل */}
              <div>
                <p className="mb-3 text-sm font-extrabold text-slate-900">بيانات التواصل</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Mail className="h-3.5 w-3.5 text-blue-600" /> البريد الإلكتروني</p>
                    <p className="mt-1.5 break-all text-sm font-bold text-slate-800">{selectedClient.email || 'غير متوفر'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><CalendarDays className="h-3.5 w-3.5 text-blue-600" /> تاريخ التسجيل</p>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">{new Date(selectedClient.created_at).toLocaleDateString('ar-EG')}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><MapPin className="h-3.5 w-3.5 text-blue-600" /> العنوان</p>
                    <p className="mt-1.5 text-sm font-bold leading-relaxed text-slate-800">{[selectedClient.province, selectedClient.city, selectedClient.detailed_address].filter(Boolean).join(' - ') || 'غير متوفر'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 p-3.5">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Phone className="h-3.5 w-3.5 text-blue-600" /> أرقام التواصل</p>
                    <div className="mt-1.5 space-y-1">
                      {selectedClient.contact_numbers && selectedClient.contact_numbers.length > 0 ? (
                        selectedClient.contact_numbers.map((contact, i) => (
                          <p key={i} className="flex items-center justify-between gap-2 text-sm font-bold text-slate-800">
                            <span className="text-xs font-medium text-slate-500">{contact.label}</span>
                            <span dir="ltr" className="tabular-nums">{contact.number}</span>
                          </p>
                        ))
                      ) : (
                        <p className="text-sm font-bold text-slate-800">غير متوفر</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* الأزرار */}
              <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
                {selectedClient.enabled ? (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white py-3.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50"
                    onClick={() => { updateClientStatus(selectedClient.id, false); }}
                  >
                    <UserX className="h-4 w-4" /> تعطيل وحظر الحساب
                  </button>
                ) : (
                  <>
                    <button
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-blue-600 to-blue-800 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-blue-700/30 transition hover:shadow-xl active:scale-[.99]"
                      onClick={() => { updateClientStatus(selectedClient.id, true); }}
                    >
                      <UserCheck className="h-4 w-4" /> قبول وتفعيل الحساب
                    </button>
                    <button
                      className="flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-5 py-3.5 text-sm font-extrabold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                      disabled={rejectingId === selectedClient.id}
                      onClick={() => handleRejectClient(selectedClient.id)}
                    >
                      {rejectingId === selectedClient.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} رفض وحذف
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== العنوان ===== */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-800 text-white shadow-lg shadow-blue-600/30 ring-4 ring-blue-50">
          <Users className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">إدارة ومراجعة حسابات العملاء والمخازن</h2>
          <p className="mt-0.5 text-sm text-slate-500">راجع التراخيص والبيانات القانونية قبل تفعيل أي حساب جديد</p>
        </div>
      </div>

      {/* ===== الإحصائيات ===== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'إجمالي العملاء', value: clients.length, icon: Users, tint: 'bg-blue-50 text-blue-600', num: 'text-slate-900' },
          { label: 'قيد المراجعة', value: pendingCount, icon: Clock, tint: 'bg-amber-50 text-amber-600', num: 'text-amber-700' },
          { label: 'حسابات مفعّلة', value: activeCount, icon: UserCheck, tint: 'bg-emerald-50 text-emerald-600', num: 'text-emerald-700' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${s.tint}`}><s.icon className="h-6 w-6" /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">{s.label}</p>
              <p className={`text-3xl font-extrabold tabular-nums leading-tight ${s.num}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          <ShieldAlert className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      {/* ===== الفلاتر والبحث ===== */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition sm:flex-none ${filter === t.id ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              {t.label} <span className={`mr-1 text-xs ${filter === t.id ? 'text-blue-100' : 'text-slate-400'}`}>({t.count})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم المخزن أو الصيدلية..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      {/* ===== عرض الكروت ===== */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50"><Users className="h-9 w-9 text-blue-400" /></div>
          <p className="font-extrabold text-slate-700">لا توجد طلبات أو عملاء حالياً</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredClients.map(client => {
            const meta = getClientDetailsMeta(client);
            return (
              <div
                key={client.id}
                className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/80"
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${client.enabled ? 'bg-gradient-to-l from-emerald-400 to-emerald-600' : 'bg-gradient-to-l from-amber-300 to-amber-500'}`} />

                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold ${client.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {meta.cleanName.charAt(0) || '؟'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-slate-900">{meta.cleanName}</p>
                      <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                        <TypeIcon type={meta.typeText} className="h-3 w-3" /> {meta.typeText}
                      </span>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${client.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    {client.enabled ? 'مفعل' : 'بانتظار المراجعة'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <DocChip label="ترخيص" value={meta.licenseNumber} />
                  <DocChip label="ضريبة" value={meta.taxNumber} />
                  <DocChip label="سجل تجاري" value={meta.commercialRecord} />
                </div>

                <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-500">
                  <p className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> رقم الترخيص</span><span className="font-mono text-sm font-extrabold text-slate-800">{meta.licenseNumber}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> البريد</span><span className="truncate font-bold text-slate-700">{client.email || 'غير متوفر'}</span></p>
                  <p className="flex items-center justify-between gap-2"><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> التسجيل</span><span className="font-bold text-slate-700">{new Date(client.created_at).toLocaleDateString('ar-EG')}</span></p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => openDetailsModal(client)}
                  >
                    <Eye className="h-4 w-4" /> معاينة
                  </button>
                  {client.enabled ? (
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50"
                      onClick={() => updateClientStatus(client.id, false)}
                    >
                      <UserX className="h-4 w-4" /> تعطيل
                    </button>
                  ) : (
                    <button
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-l from-blue-600 to-blue-800 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-700/25 transition hover:shadow-lg active:scale-[.98]"
                      onClick={() => updateClientStatus(client.id, true)}
                    >
                      <UserCheck className="h-4 w-4" /> قبول
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}