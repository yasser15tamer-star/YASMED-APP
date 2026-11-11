import { AccountSecurityForm } from '@/components/AccountSecurityForm';
import { useAuth } from '@/context/AuthContext';
import { BadgeCheck, CalendarDays, ShieldCheck, Store } from 'lucide-react';

const NAME_PATTERN = /^(.*?)\s*\[\s*(.*?)\s*-\s*ترخيص\s*:\s*(\d+)\s*\]\s*$/;

function parseFullName(raw: string) {
  const match = raw.match(NAME_PATTERN);
  if (!match) return { name: raw.trim(), type: null as string | null, license: null as string | null };
  return { name: match[1].trim(), type: match[2].trim() || null, license: match[3] };
}

function Info({
  icon: Icon,
  label,
  value,
  tone,
  ltr,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  tone: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p dir={ltr ? 'ltr' : undefined} className={`truncate text-[15px] font-bold tabular-nums text-slate-800 ${ltr ? 'text-right' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

export function ClientAccount() {
  const { profile } = useAuth();
  const parsed = parseFullName(profile?.full_name || '');
  const registeredAt = profile
    ? new Date(profile.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-10">
      <div className="mb-2">
        <h2 className="text-[28px] font-bold text-slate-900">الإعدادات</h2>
        <p className="text-sm text-slate-500">إدارة حسابك وبيانات التواصل الخاصة بك</p>
      </div>

      {/* ===== بطاقة بيانات الحساب ===== */}
      <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3.5 border-b border-slate-100 bg-gradient-to-l from-sky-50/80 to-transparent px-5 py-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-blue-600/10 text-blue-600">
            <Store className="h-[22px] w-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold text-slate-900">{parsed.name || 'حسابي'}</h3>
            <p className="text-[13px] text-slate-500">بيانات حسابك المسجلة لدينا</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <BadgeCheck className="h-3.5 w-3.5" /> عميل نشط
          </span>
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          {parsed.type && <Info icon={Store} label="النشاط" value={parsed.type} tone="bg-sky-500/10 text-sky-600" />}
          {parsed.license && (
            <Info icon={ShieldCheck} label="رقم الترخيص" value={parsed.license} tone="bg-emerald-500/10 text-emerald-600" ltr />
          )}
          {registeredAt && (
            <Info icon={CalendarDays} label="تاريخ التسجيل" value={registeredAt} tone="bg-amber-500/10 text-amber-600" ltr />
          )}
        </div>
      </section>

      {/* ===== الفورم: نفس المنطق، بس بنفس ستايل الحقول الجديد ===== */}
      <div
        className="
          [&_label]:text-[13px] [&_label]:font-semibold [&_label]:text-slate-500
          [&_input]:h-[46px] [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:text-[14.5px]
          [&_select]:h-[46px] [&_select]:rounded-xl [&_select]:border-slate-200 [&_select]:text-[14.5px]
          [&_input:focus]:border-blue-600 [&_input:focus]:ring-4 [&_input:focus]:ring-blue-600/15
          [&_select:focus]:border-blue-600 [&_select:focus]:ring-4 [&_select:focus]:ring-blue-600/15
        "
      >
        <AccountSecurityForm preserveClientRegistration />
      </div>
    </div>
  );
}