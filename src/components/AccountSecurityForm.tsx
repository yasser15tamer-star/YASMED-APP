import { useEffect, useState, type ReactNode } from 'react';
import { Input } from '@/components/ui/Input';
import { LocationSelect } from '@/components/LocationSelect';
import { useAuth } from '@/context/AuthContext';
import { supabase, type ContactNumber } from '@/lib/supabase';
import {
  AlertCircle, CheckCircle2, Eye, EyeOff, FileText, KeyRound, Loader2, Mail, MapPin,
  Phone, Plus, Save, ShieldCheck, Trash2, UserRound,
} from 'lucide-react';

const NAME_PATTERN = /^(.*?)\s*\[\s*(.*?)\s*-\s*ترخيص\s*:\s*(\d+)\s*\]\s*$/;

function parseClientName(raw: string) {
  const match = raw.match(NAME_PATTERN);
  return match
    ? { name: match[1].trim(), suffix: ` [${match[2].trim()} - ترخيص: ${match[3]}]` }
    : { name: raw.trim(), suffix: '' };
}

interface AccountSecurityFormProps {
  preserveClientRegistration?: boolean;
}

/* ألوان الأقسام: أيقونة بخلفية فاتحة + عنوان بتدرّج خفيف */
const TONES = {
  sky: { icon: 'bg-blue-600/10 text-blue-600', head: 'from-sky-50/80' },
  emerald: { icon: 'bg-emerald-600/10 text-emerald-600', head: 'from-emerald-50/80' },
  violet: { icon: 'bg-violet-600/10 text-violet-600', head: 'from-violet-50/80' },
  amber: { icon: 'bg-amber-500/15 text-amber-600', head: 'from-amber-50/80' },
} as const;

function Section({ tone, icon, title, desc, action, children }: { tone: keyof typeof TONES; icon: ReactNode; title: string; desc?: string; action?: ReactNode; children: ReactNode }) {
  const t = TONES[tone];
  return (
    <section className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
      <header className={`flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l ${t.head} to-transparent px-5 py-4`}>
        <div className="flex min-w-0 items-center gap-3.5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${t.icon}`}>{icon}</div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
            {desc && <p className="text-[13px] text-slate-500">{desc}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

/* حقل كلمة المرور: العين جوّه الحقل نفسه */
function PasswordField({ label, value, onChange, placeholder, autoComplete, children }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string; children?: ReactNode;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          dir="ltr"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-12 pr-4 text-right text-sm text-slate-800 transition-colors placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          aria-label={show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
          aria-pressed={show}
          className={`absolute left-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition hover:bg-blue-50 hover:text-blue-600 ${show ? 'text-blue-600' : 'text-slate-400'}`}
        >
          {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {children}
    </div>
  );
}

function strengthOf(p: string) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH_LABEL = ['ضعيفة', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];
const STRENGTH_COLOR = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-400', 'bg-emerald-600'];

type TabKey = 'account' | 'contact';

export function AccountSecurityForm({ preserveClientRegistration = false }: AccountSecurityFormProps) {
  const { profile, session, refreshProfile } = useAuth();
  const parsed = parseClientName(profile?.full_name || '');
  const [tab, setTab] = useState<TabKey>('account');
  const [name, setName] = useState(parsed.name);
  const [email, setEmail] = useState(session?.user.email || '');
  const [province, setProvince] = useState(profile?.province || '');
  const [city, setCity] = useState(profile?.city || '');
  const [address, setAddress] = useState(profile?.detailed_address || '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number || '');
  const [taxNumber, setTaxNumber] = useState(profile?.tax_number || '');
  const [commercialRecord, setCommercialRecord] = useState(profile?.commercial_record || '');
  const [contacts, setContacts] = useState<ContactNumber[]>(profile?.contact_numbers || []);
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setName(parsed.name);
    setEmail(session?.user.email || '');
    setProvince(profile?.province || '');
    setCity(profile?.city || '');
    setAddress(profile?.detailed_address || '');
    setLicenseNumber(profile?.license_number || '');
    setTaxNumber(profile?.tax_number || '');
    setCommercialRecord(profile?.commercial_record || '');
    setContacts(profile?.contact_numbers || []);
  }, [profile, session?.user.email]);

  const addContact = () => setContacts(prev => [...prev, { label: '', number: '' }]);
  const updateContact = (index: number, field: keyof ContactNumber, value: string) => {
    setContacts(prev => prev.map((contact, i) => i === index ? { ...contact, [field]: value } : contact));
  };
  const removeContact = (index: number) => setContacts(prev => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!profile || !session) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const cleanContacts = contacts.map(contact => ({ label: contact.label.trim(), number: contact.number.trim() })).filter(contact => contact.label && contact.number);
    if (!trimmedName || !trimmedEmail) { setError('الاسم والبريد الإلكتروني مطلوبان'); return; }
    if (password && password.length < 6) { setError('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
    if (password !== passwordConfirmation) { setError('تأكيد كلمة المرور غير متطابق'); return; }

    setSaving(true); setError(null); setSuccess(null);
    const storedName = preserveClientRegistration ? `${trimmedName}${parsed.suffix}` : trimmedName;
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: storedName,
        province: province.trim() || null,
        city: city.trim() || null,
        detailed_address: address.trim() || null,
        license_number: licenseNumber.trim() || null,
        tax_number: taxNumber.trim() || null,
        commercial_record: commercialRecord.trim() || null,
        contact_numbers: cleanContacts,
      }).eq('id', profile.id);
      if (profileError) throw profileError;

      const emailChanged = trimmedEmail.toLowerCase() !== (session.user.email || '').toLowerCase();
      if (emailChanged || password) {
        const attributes: { email?: string; password?: string } = {};
        if (emailChanged) attributes.email = trimmedEmail;
        if (password) attributes.password = password;
        const { error: authError } = await supabase.auth.updateUser(attributes);
        if (authError) throw authError;
      }

      await refreshProfile();
      setPassword(''); setPasswordConfirmation('');
      setSuccess(emailChanged ? 'تم حفظ البيانات. قد يطلب منك تأكيد البريد الجديد من رسالة تصل إليه.' : 'تم حفظ بيانات الحساب بنجاح');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'فشل في تحديث بيانات الحساب');
    } finally { setSaving(false); }
  };

  const strength = password ? strengthOf(password) : 0;
  const tabs: { key: TabKey; label: string; icon: ReactNode }[] = [
    { key: 'account', label: 'الحساب والأمان', icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
    { key: 'contact', label: 'بيانات التواصل', icon: <Phone className="h-[18px] w-[18px]" /> },
  ];

  return (
    <div className="space-y-4">

      {/* التابات */}
      <div role="tablist" className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`flex min-w-max flex-1 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${
              tab === t.key ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === 'account' && (
        <>
          {/* البيانات الأساسية */}
          <Section tone="sky" icon={<UserRound className="h-[22px] w-[22px]" />} title="بيانات الحساب" desc="الاسم والبريد الإلكتروني المرتبط بحسابك">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="الاسم" value={name} onChange={e => setName(e.target.value)} />
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">البريد الإلكتروني</label>
                <div className="relative">
                  <Mail className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    dir="ltr"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm text-slate-800 transition-colors focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-600/15"
                  />
                </div>
              </div>
            </div>
          </Section>

          {/* العنوان والبيانات القانونية */}
          <Section tone="emerald" icon={<MapPin className="h-[22px] w-[22px]" />} title="العنوان والبيانات القانونية" desc="تظهر للإدارة مع كل طلب تقوم به">
            <LocationSelect
              province={province}
              city={city}
              onChange={(p, c) => { setProvince(p); setCity(c); }}
            />
            <Input label="العنوان بالتفصيل" value={address} onChange={e => setAddress(e.target.value)} placeholder="الشارع، رقم العقار، الدور..." />

            <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4 text-blue-600" /> المستندات
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="رقم الترخيص" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} />
                <Input label="الرقم الضريبي" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} />
                <Input label="السجل التجاري" value={commercialRecord} onChange={e => setCommercialRecord(e.target.value)} />
              </div>
            </div>
          </Section>

          {/* تغيير كلمة المرور */}
          <Section tone="amber" icon={<KeyRound className="h-[22px] w-[22px]" />} title="تغيير كلمة المرور" desc="اتركها فارغة إذا لا تريد التغيير">
            <div className="grid gap-4 sm:grid-cols-2">
              <PasswordField label="كلمة المرور الجديدة" value={password} onChange={setPassword} placeholder="اتركها فارغة بدون تغيير" autoComplete="new-password">
                {password && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? STRENGTH_COLOR[strength] : 'bg-slate-200'}`} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-slate-500">{STRENGTH_LABEL[strength]}</span>
                  </div>
                )}
              </PasswordField>
              <PasswordField label="تأكيد كلمة المرور" value={passwordConfirmation} onChange={setPasswordConfirmation} placeholder="أعد كتابة كلمة المرور" autoComplete="new-password">
                {passwordConfirmation && (
                  <p className={`mt-2 text-xs font-semibold ${passwordConfirmation === password ? 'text-emerald-600' : 'text-red-500'}`}>
                    {passwordConfirmation === password ? 'كلمتا المرور متطابقتان' : 'كلمتا المرور غير متطابقتين'}
                  </p>
                )}
              </PasswordField>
            </div>
          </Section>
        </>
      )}

      {tab === 'contact' && (
        <Section
          tone="violet"
          icon={<Phone className="h-[22px] w-[22px]" />}
          title="أرقام التواصل"
          desc="أضف أرضي أو موبايل أو واتساب أو أي نوع تريده"
          action={
            <button type="button" onClick={addContact} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-600/10 px-4 py-2 text-xs font-extrabold text-violet-700 transition hover:bg-violet-600/15">
              <Plus className="h-4 w-4" /> إضافة رقم
            </button>
          }
        >
          {contacts.length === 0 ? (
            <button type="button" onClick={addContact} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-9 text-slate-400 transition hover:border-violet-300 hover:text-violet-600">
              <Phone className="h-6 w-6" />
              <span className="text-sm font-semibold">لا توجد أرقام بعد، اضغط لإضافة رقم</span>
            </button>
          ) : (
            <div className="space-y-3">
              {contacts.map((contact, index) => (
                <div key={index} className="flex items-end gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex-1">
                    <Input label={index === 0 ? 'نوع الرقم' : undefined} value={contact.label} onChange={e => updateContact(index, 'label', e.target.value)} placeholder="واتساب / أرضي / موبايل" />
                  </div>
                  <div className="flex-1">
                    <Input label={index === 0 ? 'الرقم' : undefined} value={contact.number} onChange={e => updateContact(index, 'number', e.target.value)} placeholder="01xxxxxxxxx" />
                  </div>
                  <button type="button" onClick={() => removeContact(index)} className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-500" aria-label="حذف الرقم">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* شريط الحفظ الثابت */}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg shadow-slate-300/30 backdrop-blur">
        <div className="min-w-0 flex-1 text-sm font-semibold">
          {error ? (
            <span className="flex items-center gap-2 text-red-600"><AlertCircle className="h-4 w-4 shrink-0" /> {error}</span>
          ) : success ? (
            <span className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="h-4 w-4 shrink-0" /> {success}</span>
          ) : (
            <span className="text-slate-400">يمكنك تعديل بياناتك في أي وقت</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ بيانات الحساب
        </button>
      </div>
    </div>
  );
}