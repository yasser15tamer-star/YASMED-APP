import { useEffect, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SocialLinks } from '@/components/SocialLinks';
import { supabase, type AppSettings } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Package, ShoppingCart, User, Clock, AlertCircle, TrendingUp, Search } from 'lucide-react';

interface ClientHomeProps {
  onNavigate: (key: string) => void;
  cartCount: number;
}

// الاسم القديم ممكن يكون فيه "[صيدلية - ترخيص: ...]" فنشيله من العرض
const cleanName = (raw: string) => raw.replace(/\s*\[.*\]\s*$/, '').trim();

export function ClientHome({ onNavigate, cartCount }: ClientHomeProps) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);

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

  useEffect(() => {
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) setSettings(data);
    });
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">أهلاً وسهلاً بك، {cleanName(profile?.full_name || '')}</h2>
      <p className="text-sm text-slate-500 mb-6">لوحة تحكم العميل</p>

      {/* Cleanup warning */}
      {settings && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 font-medium">
            تنبيه: سيتم حذف ملفات المقارنة المؤقتة من الساعة {formatTime12Hour(settings.cleanup_start_time)} إلى الساعة {formatTime12Hour(settings.cleanup_end_time)} حسب إعدادات الإدارة.
          </p>
        </div>
      )}

      {/* Quick action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('comparison')}>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center"><Search className="w-6 h-6 text-teal-600" /></div>
            <div>
              <p className="font-bold text-slate-800">مركز المقارنة</p>
              <p className="text-xs text-slate-500">ارفع ملف النواقص وابدأ المقارنة</p>
            </div>
          </CardBody>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('cart')}>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center relative">
              <ShoppingCart className="w-6 h-6 text-amber-600" />
              {cartCount > 0 && <span className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">{cartCount}</span>}
            </div>
            <div>
              <p className="font-bold text-slate-800">السلة</p>
              <p className="text-xs text-slate-500">{cartCount} منتج في السلة</p>
            </div>
          </CardBody>
        </Card>
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('account')}>
          <CardBody className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><User className="w-6 h-6 text-slate-600" /></div>
            <div>
              <p className="font-bold text-slate-800">الحساب</p>
              <p className="text-xs text-slate-500">إدارة بياناتك الشخصية</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Start comparison CTA */}
      <Card>
        <CardBody className="p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-50 mb-4">
            <Package className="w-8 h-8 text-teal-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-2">مركز مقارنة الموردين</h3>
          <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">ارفع ملف النواقص الخاص بشركتك ليتم مقارنته مع جميع موردين النظام. ستحصل على نتائج مفصلة مع الأسعار والخصومات.</p>
          <Button size="lg" onClick={() => onNavigate('comparison')}>
            <Search className="w-4 h-4" /> بدء المقارنة
          </Button>
        </CardBody>
      </Card>

      {/* تواصل معنا: حساباتي على السوشيال */}
      <Card className="mt-6">
        <CardBody className="p-6 text-center">
          <h3 className="text-base font-bold text-slate-800 mb-1">تواصل معنا</h3>
          <p className="text-sm text-slate-500 mb-4">تابعنا أو راسلنا على حساباتنا</p>
          <SocialLinks variant="labeled" />
        </CardBody>
      </Card>
    </div>
  );
}