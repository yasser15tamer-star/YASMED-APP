import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { AccountSecurityForm } from '@/components/AccountSecurityForm';
import { Button } from '@/components/ui/Button';
import { supabase, type AppSettings, type ComparisonSession } from '@/lib/supabase';
import { AlertCircle, CheckCircle2, Loader2, Clock, Trash2, Phone, ShieldCheck, FileSpreadsheet, Save, type LucideIcon } from 'lucide-react';

const DEFAULT_SUPPORT_NAME = 'البشمهندس / ياسر تامر (صاحب النظام والمخزن)';
const DEFAULT_SUPPORT_PHONE = '01013629789';

type TabKey = 'account' | 'contact' | 'files';

const INPUT_CLASS =
  'w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-colors';

const TONES = {
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
} as const;

// عنوان موحد لكل قسم: أيقونة ملونة + عنوان + وصف
function SectionHeader({ icon: Icon, title, desc, tone = 'sky', action }: {
  icon: LucideIcon;
  title: string;
  desc?: string;
  tone?: keyof typeof TONES;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${TONES[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800">{title}</h3>
          {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

// اختيار الوقت بالقوائم: ساعة : دقيقة + AM/PM (من غير كتابة بالإيد)
// القيمة بتتخزن بصيغة 24 ساعة "HH:MM" زي ما كانت
function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [hStr, mStr] = (value || '00:00').split(':');
  const h24 = parseInt(hStr, 10) || 0;
  const minute = parseInt(mStr, 10) || 0;
  const isPM = h24 >= 12;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

  const emit = (hour12: number, min: number, pm: boolean) => {
    const h = (hour12 % 12) + (pm ? 12 : 0);
    onChange(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`);
  };

  // الدقايق كل 5، ولو القيمة المحفوظة مش منهم نضيفها عشان ماتضيعش
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);
  if (!minutes.includes(minute)) minutes.push(minute);
  minutes.sort((a, b) => a - b);

  const selectClass = `${INPUT_CLASS} flex-1 text-center font-semibold cursor-pointer`;

  return (
    <div dir="ltr" className="flex items-center gap-2">
      <select
        value={h12}
        onChange={e => emit(Number(e.target.value), minute, isPM)}
        aria-label="الساعة"
        className={selectClass}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
        ))}
      </select>

      <span className="text-lg font-bold text-slate-400">:</span>

      <select
        value={minute}
        onChange={e => emit(h12, Number(e.target.value), isPM)}
        aria-label="الدقيقة"
        className={selectClass}
      >
        {minutes.map(m => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>

      <div className="flex p-1 rounded-xl bg-slate-100 shrink-0">
        {([['AM', false], ['PM', true]] as const).map(([label, pm]) => (
          <button
            key={label}
            type="button"
            onClick={() => emit(h12, minute, pm)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-all ${
              isPM === pm
                ? 'bg-[#0b7ae0] text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('02:00');
  const [supportName, setSupportName] = useState(DEFAULT_SUPPORT_NAME);
  const [supportPhone, setSupportPhone] = useState(DEFAULT_SUPPORT_PHONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ComparisonSession[]>([]);
  const [cleaning, setCleaning] = useState(false);
  const [tab, setTab] = useState<TabKey>('account');

  // دالة لتحويل الوقت من 24 ساعة إلى صيغة 12 ساعة مع AM/PM
  const formatTime12Hour = (timeStr: string) => {
    if (!timeStr) return '';
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (error) { setError('فشل في تحميل الإعدادات'); }
    else if (data) {
      setSettings(data);
      setStartTime(data.cleanup_start_time);
      setEndTime(data.cleanup_end_time);
      setSupportName(data.support_name || DEFAULT_SUPPORT_NAME);
      setSupportPhone(data.support_phone || DEFAULT_SUPPORT_PHONE);
    }
    setLoading(false);
  }, []);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase.from('comparison_sessions').select('*').order('created_at', { ascending: false });
    setSessions(data || []);
  }, []);

  useEffect(() => { fetchSettings(); fetchSessions(); }, [fetchSettings, fetchSessions]);

  // هل في تغييرات لسه ما اتحفظتش؟
  const finalName = supportName.trim() || DEFAULT_SUPPORT_NAME;
  const finalPhone = supportPhone.trim() || DEFAULT_SUPPORT_PHONE;
  const dirty = !!settings && (
    startTime !== settings.cleanup_start_time ||
    endTime !== settings.cleanup_end_time ||
    finalName !== (settings.support_name || DEFAULT_SUPPORT_NAME) ||
    finalPhone !== (settings.support_phone || DEFAULT_SUPPORT_PHONE)
  );

  const handleSave = async () => {
    setSaving(true); setError(null);
    const { error } = await supabase.from('app_settings').update({
      cleanup_start_time: startTime,
      cleanup_end_time: endTime,
      support_name: finalName,
      support_phone: finalPhone,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    if (error) {
      setError('فشل في حفظ الإعدادات');
    } else {
      setSettings(prev => prev ? { ...prev, cleanup_start_time: startTime, cleanup_end_time: endTime, support_name: finalName, support_phone: finalPhone } : prev);
      setSupportName(finalName);
      setSupportPhone(finalPhone);
      setSuccess('تم حفظ الإعدادات بنجاح');
      setTimeout(() => setSuccess(null), 3000);
    }
    setSaving(false);
  };

  // إلغاء التعديلات والرجوع لآخر قيم محفوظة
  const handleDiscard = () => {
    if (!settings) return;
    setStartTime(settings.cleanup_start_time);
    setEndTime(settings.cleanup_end_time);
    setSupportName(settings.support_name || DEFAULT_SUPPORT_NAME);
    setSupportPhone(settings.support_phone || DEFAULT_SUPPORT_PHONE);
  };

  const handleCleanSessions = async () => {
    if (!confirm('هل أنت متأكد من مسح جميع ملفات المقارنة المؤقتة؟ هذا لن يحذف ملفات الموردين.')) return;
    setCleaning(true); setError(null);
    const { error } = await supabase.from('comparison_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) setError('فشل في المسح');
    else { setSuccess('تم مسح ملفات المقارنة المؤقتة'); fetchSessions(); setTimeout(() => setSuccess(null), 3000); }
    setCleaning(false);
  };

  const handleDeleteSession = async (id: string) => {
    const { error } = await supabase.from('comparison_sessions').delete().eq('id', id);
    if (!error) fetchSessions();
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-sky-600 animate-spin" /></div>;

  const tabs: { key: TabKey; label: string; icon: LucideIcon; badge?: number }[] = [
    { key: 'account', label: 'الحساب والأمان', icon: ShieldCheck },
    { key: 'contact', label: 'بيانات التواصل', icon: Phone },
    { key: 'files', label: 'الملفات المؤقتة', icon: FileSpreadsheet, badge: sessions.length },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">الإعدادات</h2>
        <p className="text-sm text-slate-500 mt-1">إدارة حسابك وبيانات التواصل وملفات النظام المؤقتة</p>
      </div>

      {/* التبويبات */}
      <div className="flex gap-1 p-1 mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              tab === key
                ? 'bg-[#0b7ae0] text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge !== undefined && badge > 0 && (
              <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                tab === key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-600'
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {success}</div>}

      {/* ===== الحساب والأمان ===== */}
      {tab === 'account' && (
        <AccountSecurityForm />
      )}

      {/* ===== بيانات التواصل ===== */}
      {tab === 'contact' && (
        <Card>
          <CardBody>
            <SectionHeader
              icon={Phone}
              title="بيانات التواصل مع العملاء"
              desc="بتظهر للعميل في رسالة انتظار المراجعة، أو عند محاولة الدخول بحساب غير مفعل."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="اسم مسؤول التواصل">
                <input type="text" value={supportName} onChange={e => setSupportName(e.target.value)} className={INPUT_CLASS} />
              </Field>
              <Field label="رقم التواصل">
                <input type="tel" dir="ltr" value={supportPhone} onChange={e => setSupportPhone(e.target.value)} className={INPUT_CLASS} />
              </Field>
            </div>

            {/* معاينة: شكل البيانات عند العميل */}
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-bold text-slate-500 mb-2">معاينة ما يراه العميل</p>
              <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
                <ShieldCheck className="w-4 h-4 shrink-0 text-sky-600" />
                <span>{finalName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600 mt-1.5">
                <Phone className="w-4 h-4 shrink-0 text-sky-600" />
                <span dir="ltr" className="font-semibold">{finalPhone}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ===== الملفات المؤقتة ===== */}
      {tab === 'files' && (
        <div className="space-y-6">
          {/* موعد المسح */}
          <Card>
            <CardBody>
              <SectionHeader
                icon={Clock}
                tone="amber"
                title="موعد مسح الملفات المؤقتة"
                desc="حدد الفترة الزمنية التي يتم فيها مسح ملفات المقارنة المؤقتة تلقائياً. ملفات الموردين لن تتأثر."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="وقت البداية">
                  <TimePicker value={startTime} onChange={setStartTime} />
                </Field>
                <Field label="وقت النهاية">
                  <TimePicker value={endTime} onChange={setEndTime} />
                </Field>
              </div>
              <div className="mt-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700">
                  سيتم عرض تنبيه للعملاء: "سيتم حذف ملفات المقارنة المؤقتة من الساعة {formatTime12Hour(startTime)} إلى الساعة {formatTime12Hour(endTime)} حسب إعدادات الإدارة."
                </p>
              </div>
            </CardBody>
          </Card>

          {/* منطقة الخطر: مسح الملفات */}
          <Card className="border border-red-200">
            <CardBody>
              <SectionHeader
                icon={Trash2}
                tone="red"
                title="مسح ملفات المقارنة المؤقتة"
                desc="الملفات المؤقتة التي رفعها العملاء. لا يحذف هذا ملفات الموردين."
                action={
                  <Button variant="danger" size="sm" onClick={handleCleanSessions} disabled={cleaning || sessions.length === 0}>
                    {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    مسح الكل ({sessions.length})
                  </Button>
                }
              />

              {sessions.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
                  <FileSpreadsheet className="w-8 h-8" />
                  <p className="text-sm">لا توجد ملفات مؤقتة حالياً</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sessions.map(session => (
                    <div key={session.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-700 truncate">{session.file_name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {session.item_count} صنف · <span dir="ltr">{new Date(session.created_at).toLocaleDateString('en-GB')}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        aria-label="حذف الملف"
                        className="p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {/* شريط الحفظ الثابت: بيظهر لما يكون في تعديلات لسه ما اتحفظتش */}
      {dirty && (
        <div className="sticky bottom-4 z-20 mt-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white/95 backdrop-blur px-4 py-3 shadow-xl shadow-sky-900/10">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              لديك تغييرات غير محفوظة
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscard}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                تراجع
              </button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#0b7ae0] hover:bg-[#0a68c4] text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ التغييرات
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}