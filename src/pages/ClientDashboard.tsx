import { useState, useEffect, useCallback } from 'react';
import { DashboardShell, type NavItem } from '@/components/DashboardShell';
import { ClientHome } from '@/pages/client/ClientHome';
import { ClientComparison } from '@/pages/client/ClientComparison';
import { ClientCart } from '@/pages/client/ClientCart';
import { ClientAccount } from '@/pages/client/ClientAccount';
import { ClientUpload } from '@/pages/client/ClientUpload'; // 1. استيراد صفحة رفع الشيتات
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Home, Search, ShoppingCart, User, FileSpreadsheet } from 'lucide-react';

const clientNavItems: NavItem[] = [
  { key: 'home', label: 'الرئيسية', icon: Home },
  { key: 'comparison', label: 'مركز مقارنة الموردين', icon: Search },
  { key: 'cart', label: 'السلة', icon: ShoppingCart },
  { key: 'upload', label: 'إرسال ملفات الإكسيل', icon: FileSpreadsheet }, // 2. إضافة العنصر الجديد للقائمة الجانبية
  { key: 'account', label: 'الحساب', icon: User },
];

export function ClientDashboard() {
  const { profile } = useAuth();
  const [activePage, setActivePage] = useState('home');
  const [cartCount, setCartCount] = useState(0);

  const fetchCartCount = useCallback(async () => {
    if (!profile) return;
    const { count } = await supabase.from('cart_items').select('*', { count: 'exact', head: true }).eq('client_id', profile.id).eq('status', 'active');
    setCartCount(count || 0);
  }, [profile]);

  useEffect(() => { fetchCartCount(); }, [fetchCartCount]);

  const renderPage = () => {
    switch (activePage) {
      case 'home': return <ClientHome onNavigate={setActivePage} cartCount={cartCount} />;
      case 'comparison': return <ClientComparison onCartUpdate={fetchCartCount} />;
      case 'cart': return <ClientCart onCartUpdate={fetchCartCount} />;
      case 'upload': return <ClientUpload />; // 3. توجيه المسار للصفحة الجديدة
      case 'account': return <ClientAccount />;
      default: return <ClientHome onNavigate={setActivePage} cartCount={cartCount} />;
    }
  };

  return (
    <DashboardShell items={clientNavItems} activeKey={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardShell>
  );
}