import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type ContactNumber } from '@/lib/supabase';
import { EGYPT_LOCATIONS } from '@/lib/egyptLocations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AccountStatusModal } from '@/components/AccountStatusModal';
import { SocialLinks } from '@/components/SocialLinks';
import { Mail, Lock, Eye, EyeOff, Store, Building2, FileText, CheckCircle2, Clock, Phone, MapPin, Pill, Search, ShoppingCart, FileSpreadsheet } from 'lucide-react';

type BusinessType = 'wholesale_warehouse' | 'retail_warehouse' | 'pharmacy';

// ====== إعدادات الهوية (عدّلها من هنا) ======
const BRAND = {
  logoSrc: '', // لو عندك صورة لوجو حط مسارها هنا، مثال: '/logo.png' (حطها في فولدر public)
  nameEn: 'YASMED',
  nameAr: 'ياسـمـد',
  slogan: 'Your Pharmacy Partner',
  tagline: 'نظام إدارة الصيدليات والمخازن',
  designer: 'أ/ ياسر تامر محمد السعيد',
  phone: '01013629789',
};
// ============================================

const FEATURES = [
  { icon: Search, title: 'مقارنة أسعار الموردين', desc: 'ارفع ملف النواقص واعرف أفضل سعر وخصم عند كل مورد' },
  { icon: ShoppingCart, title: 'سلة وطلبات منظمة', desc: 'أضف المنتجات للسلة وتابع طلباتك بسهولة' },
  { icon: FileSpreadsheet, title: 'رفع ملفات الإكسيل', desc: 'أرسل شيتات الأسعار مباشرة للإدارة' },
];

const PROVINCES = Object.keys(EGYPT_LOCATIONS);
const OTHER_CITY = '__other__'; // اختيار "أخرى" في قائمة المدن

const BUSINESS_TYPES: { key: BusinessType; label: string; icon: typeof Store }[] = [
  { key: 'wholesale_warehouse', label: 'مخزن جملة', icon: Building2 },
  { key: 'retail_warehouse', label: 'مخزن قطاعي', icon: Store },
  { key: 'pharmacy', label: 'صيدلية', icon: CheckCircle2 },
];

export function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [businessType, setBusinessType] = useState<BusinessType>('wholesale_warehouse');
  const [storeName, setStoreName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [commercialRecord, setCommercialRecord] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [cityOther, setCityOther] = useState(false); // لو العميل اختار "أخرى" يكتب المدينة بنفسه
  const cities = EGYPT_LOCATIONS[province] ?? [];
  const [detailedAddress, setDetailedAddress] = useState('');
  const [contactNumbers, setContactNumbers] = useState<ContactNumber[]>([{ label: 'موبايل', number: '' }]);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // نافذة الحساب الموقوف أو بانتظار المراجعة
  const [suspendedModal, setSuspendedModal] = useState(false);
  const [modalType, setModalType] = useState<'suspended' | 'pending'>('suspended');
  const [supportName, setSupportName] = useState('البشمهندس / ياسر تامر (صاحب النظام والمخزن)');
  const [supportPhone, setSupportPhone] = useState('01013629789');

  useEffect(() => {
    let active = true;
    supabase.rpc('get_support_contact').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (!active || !row) return;
      if (typeof row.support_name === 'string' && row.support_name.trim()) setSupportName(row.support_name);
      if (typeof row.support_phone === 'string' && row.support_phone.trim()) setSupportPhone(row.support_phone);
    });
    return () => { active = false; };
  }, []);

  const getBusinessTitle = () => {
    switch (businessType) {
      case 'wholesale_warehouse': return 'اسم مخزن الجملة';
      case 'retail_warehouse': return 'اسم المخزن القطاعي';
      case 'pharmacy': return 'اسم الصيدلية';
    }
  };

  const getBusinessPlaceholder = () => {
    switch (businessType) {
      case 'wholesale_warehouse': return 'أدخل اسم مخزن الجملة';
      case 'retail_warehouse': return 'أدخل اسم المخزن القطاعي';
      case 'pharmacy': return 'أدخل اسم الصيدلية';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    let finalPassword = password;
    const isAdminEmail = email.trim().toLowerCase() === 'admin@center.com';

    if (!isAdminEmail) {
      finalPassword = password + '@Ab1';
    }

    if (mode === 'login') {
      const res = await signIn(email, finalPassword);

      if (res.error) {
        if (res.error.includes('مفعل') || res.error.includes('معلق') || res.error.includes('بانتظار') || res.error.includes('مراجعة') || res.error.includes('suspended') || res.error.includes('pending') || res.error.includes('disabled')) {
          setModalType('suspended');
          setSuspendedModal(true);
        } else {
          setError(res.error);
        }
      }
    } else {
      // عملية إنشاء حساب جديد
      if (storeName.trim().length < 2) {
        setError(`يرجى إدخال ${getBusinessTitle()}`);
        setLoading(false);
        return;
      }
      if (!licenseNumber.trim()) {
        setError('رقم الترخيص مطلوب لتقديم طلب التسجيل');
        setLoading(false);
        return;
      }
      if (!province.trim() || !city.trim() || !detailedAddress.trim()) {
        setError('المحافظة والمدينة والعنوان بالتفصيل مطلوبة');
        setLoading(false);
        return;
      }
      const cleanContacts = contactNumbers.map(contact => ({ label: contact.label.trim(), number: contact.number.trim() })).filter(contact => contact.label && contact.number);
      if (cleanContacts.length === 0) {
        setError('أضف رقم تواصل واحد على الأقل');
        setLoading(false);
        return;
      }

      const fullMetaDataName = `${storeName} [${businessType === 'wholesale_warehouse' ? 'مخزن جملة' : businessType === 'retail_warehouse' ? 'مخزن قطاعي' : 'صيدلية'} - ترخيص: ${licenseNumber}]`;

      // استدعاء دالة الـ signUp المحدثة
      const res = await signUp(email, finalPassword, fullMetaDataName, {
        businessType,
        licenseNumber,
        taxNumber,
        commercialRecord,
        province,
        city,
        detailedAddress,
        contactNumbers: cleanContacts,
        status: 'pending'
      });

      if (res.error && !res.error.includes('تم إنشاء الحساب')) {
        setError(res.error);
      } else {
        // إظهار نافذة قيد المراجعة في وجه العميل فوراً ومنعه من الدخول تماماً
        setModalType('pending');
        setSuspendedModal(true);
        setMode('login');
        setPassword('');
        setStoreName('');
        setLicenseNumber('');
        setTaxNumber('');
        setCommercialRecord('');
        setProvince('');
        setCity('');
        setCityOther(false);
        setDetailedAddress('');
        setContactNumbers([{ label: 'موبايل', number: '' }]);
      }
    }
    setLoading(false);
  };

  const logo = (size: string, iconSize: string) =>
    BRAND.logoSrc ? (
      <img src={BRAND.logoSrc} alt={BRAND.nameEn} className={`${size} object-contain`} />
    ) : (
      <div className={`${size} inline-flex items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 ring-1 ring-white/20`}>
        <Pill className={iconSize} />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#04101f] lg:grid lg:grid-cols-[1fr_1.1fr] relative">

      {/* نافذة منبثقة (Modal) للحسابات الموقوفة أو قيد المراجعة */}
      <AccountStatusModal
        open={suspendedModal}
        type={modalType}
        onClose={() => setSuspendedModal(false)}
        supportName={supportName}
        supportPhone={supportPhone}
        designer={BRAND.designer}
        designerPhone={BRAND.phone}
      />

      {/* ===== لوحة الهوية (كمبيوتر فقط) ===== */}
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen relative overflow-hidden items-center justify-center p-12 xl:p-16 bg-gradient-to-b from-[#071b30] via-[#061a2e] to-[#04101f] border-l border-sky-500/15">
        <div className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-24 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl" />

        {/* المحتوى متجمع في عمود واحد في النص بدل ما يتوزع على أطراف اللوحة */}
        <div className="relative w-full max-w-xl space-y-12">
        <div className="flex items-center gap-4">
          {logo('w-16 h-16', 'w-8 h-8')}
          <div className="leading-tight">
            <h1 className="text-3xl font-extrabold tracking-wide text-white" dir="ltr">{BRAND.nameEn}</h1>
            <p className="text-lg font-bold text-sky-400">{BRAND.nameAr}</p>
            <p className="text-xs text-slate-400" dir="ltr">{BRAND.slogan}</p>
          </div>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white leading-snug">{BRAND.tagline}</h2>
            <p className="mt-3 text-slate-400 max-w-md">منصة واحدة تجمع الصيدليات والمخازن والموردين، لمقارنة الأسعار وإدارة الطلبات بسرعة ودقة.</p>
          </div>

          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-4 rounded-xl border border-sky-500/15 bg-[#0a2540]/50 px-4 py-3">
                <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-bold text-white text-sm">{title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="pt-6 border-t border-sky-500/15 text-xs text-slate-500 space-y-1.5">
          <p>تصميم وتطوير: <span className="text-slate-300 font-semibold">{BRAND.designer}</span></p>
          <a href={`tel:${BRAND.phone}`} dir="ltr" className="inline-flex items-center gap-1.5 font-semibold text-sky-400 hover:text-sky-300 transition-colors">
            <Phone className="w-3.5 h-3.5" />
            {BRAND.phone}
          </a>
        </div>
        </div>
      </aside>

      {/* ===== الفورم ===== */}
      <main className="flex items-center justify-center p-4 sm:p-8 relative">
        <div className="w-full max-w-lg xl:max-w-xl py-6">

          {/* هيدر مصغر للموبايل */}
          <div className="lg:hidden text-center mb-6">
            <div className="flex items-center justify-center gap-3">
              {logo('w-12 h-12', 'w-6 h-6')}
              <div className="text-right leading-tight">
                <h1 className="text-2xl font-extrabold tracking-wide text-white" dir="ltr">{BRAND.nameEn}</h1>
                <p className="text-sm font-bold text-sky-400">{BRAND.nameAr}</p>
              </div>
            </div>
            <p className="mt-3 text-sm font-semibold text-sky-300">{BRAND.tagline}</p>
          </div>

          <div className="hidden lg:block mb-6">
            <h2 className="text-2xl font-extrabold text-white">
              {mode === 'login' ? 'أهلاً بعودتك' : 'إنشاء حساب جديد'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              {mode === 'login' ? 'سجّل دخولك للوصول إلى لوحة التحكم' : 'املأ البيانات وسيتم مراجعة طلبك من الإدارة'}
            </p>
          </div>

          <div className="flex gap-1 p-1 bg-white/5 border border-sky-500/20 rounded-xl mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); setInfo(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'login' ? 'bg-[#0b7ae0] text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]' : 'text-slate-300 hover:text-white'}`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setInfo(null); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${mode === 'signup' ? 'bg-[#0b7ae0] text-white shadow-[0_0_14px_rgba(56,189,248,0.35)]' : 'text-slate-300 hover:text-white'}`}
            >
              إنشاء حساب جديد
            </button>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl shadow-black/30 border border-sky-500/10 p-6 space-y-4">

            {mode === 'signup' && (
              <div className="space-y-4 pb-3 border-b border-slate-100">
                <label className="block text-xs font-bold text-slate-700">اختر نوع النشاط التجاري:</label>
                <div className="grid grid-cols-3 gap-2">
                  {BUSINESS_TYPES.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBusinessType(key)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                        businessType === key
                          ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-sm'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <Icon className="w-5 h-5 mb-1 text-sky-600" />
                      {label}
                    </button>
                  ))}
                </div>

                <Input
                  label={getBusinessTitle()}
                  placeholder={getBusinessPlaceholder()}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  icon={<Store className="w-4 h-4" />}
                  required
                />
              </div>
            )}

            <Input
              label="البريد الإلكتروني"
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />

            <div className="relative">
              <Input
                label="كلمة المرور"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
              />
              {/* زر العين: بيبدل نوع الحقل بين password و text */}
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-2 bottom-[5px] flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {mode === 'signup' && (
              <div className="pt-3 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <MapPin className="w-4 h-4 text-sky-600" />
                  بيانات العنوان والتواصل
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">المحافظة *</label>
                    <select
                      value={province}
                      onChange={e => { setProvince(e.target.value); setCity(''); setCityOther(false); }}
                      required
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800"
                    >
                      <option value="">اختر المحافظة</option>
                      {PROVINCES.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">المدينة / المركز *</label>
                    <select
                      value={cityOther ? OTHER_CITY : city}
                      onChange={e => {
                        if (e.target.value === OTHER_CITY) { setCityOther(true); setCity(''); }
                        else { setCityOther(false); setCity(e.target.value); }
                      }}
                      required
                      disabled={!province}
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <option value="">{province ? 'اختر المدينة' : 'اختر المحافظة أولاً'}</option>
                      {cities.map(c => <option key={c} value={c}>{c}</option>)}
                      {province && <option value={OTHER_CITY}>أخرى (اكتب المدينة)</option>}
                    </select>
                    {cityOther && (
                      <Input value={city} onChange={e => setCity(e.target.value)} required placeholder="اكتب اسم المدينة" />
                    )}
                  </div>
                </div>

                <Input label="العنوان بالتفصيل *" value={detailedAddress} onChange={e => setDetailedAddress(e.target.value)} required placeholder="الشارع، رقم العقار، الدور..." />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">أرقام التواصل *</label>
                    <button
                      type="button"
                      onClick={() => setContactNumbers(prev => [...prev, { label: '', number: '' }])}
                      className="text-xs font-bold text-sky-700 hover:text-sky-800"
                    >
                      + إضافة رقم
                    </button>
                  </div>
                  {contactNumbers.map((contact, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        label={index === 0 ? 'نوع الرقم' : undefined}
                        value={contact.label}
                        onChange={e => setContactNumbers(prev => prev.map((item, i) => i === index ? { ...item, label: e.target.value } : item))}
                        placeholder="موبايل / واتساب / أرضي"
                      />
                      <Input
                        label={index === 0 ? 'الرقم' : undefined}
                        value={contact.number}
                        onChange={e => setContactNumbers(prev => prev.map((item, i) => i === index ? { ...item, number: e.target.value } : item))}
                        placeholder="01xxxxxxxxx"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                  <FileText className="w-4 h-4 text-sky-600" />
                  المستندات والبيانات القانونية للمراجعة
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="رقم الترخيص *"
                    placeholder="LIC-2024-XXXXXX"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    required
                  />
                  <Input
                    label="الرقم الضريبي (اختياري)"
                    placeholder="123-456-789"
                    value={taxNumber}
                    onChange={(e) => setTaxNumber(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="رقم السجل التجاري (اختياري)"
                    placeholder="مثال: 987654"
                    value={commercialRecord}
                    onChange={(e) => setCommercialRecord(e.target.value)}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            {info && (
              <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-medium flex items-start gap-2">
                <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                <span>{info}</span>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full bg-[#0b7ae0] hover:bg-[#0a68c4] text-white shadow-lg shadow-sky-500/25" disabled={loading}>
              {loading ? 'جارٍ المعالجة...' : mode === 'login' ? 'تسجيل الدخول' : 'إرسال طلب التسجيل للمراجعة'}
            </Button>

            {mode === 'signup' && (
              <p className="text-xs text-slate-500 text-center">
                لن يتمكن الحساب من الدخول إلا بعد مراجعة وقبول الإدارة للمستندات
              </p>
            )}
          </form>

          {/* للتواصل والدعم: أيقونات السوشيال تحت الفورم */}
          <div className="mt-6 text-center">
            <p className="mb-2 text-xs text-slate-400"> للتواصل  مع مصمم الموقع </p>
            <SocialLinks variant="compact" />
          </div>

          <div className="mt-8 pt-5 border-t border-white/10 text-center text-xs text-slate-500 space-y-1.5">
            <p>جميع الحقوق محفوظة <bdi>© {new Date().getFullYear()} {BRAND.nameEn}</bdi></p>
            <p>تصميم وتطوير: <span className="text-slate-300 font-semibold">{BRAND.designer}</span></p>
            <a href={`tel:${BRAND.phone}`} dir="ltr" className="inline-flex items-center gap-1.5 font-semibold text-sky-400 hover:text-sky-300 transition-colors">
              <Phone className="w-3.5 h-3.5" />
              {BRAND.phone}
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}