import { useState } from 'react';
import { DashboardShell, type NavItem } from '@/components/DashboardShell';
import { AdminHome } from '@/pages/admin/AdminHome';
import { WholesaleSuppliers } from '@/pages/admin/WholesaleSuppliers';
import { RetailSuppliers } from '@/pages/admin/RetailSuppliers';
import { PharmacySuppliers } from '@/pages/admin/PharmacySuppliers';
import { AdminComparison } from '@/pages/admin/AdminComparison';
import { AdminOrders } from '@/pages/admin/AdminOrders';
import { AdminClientManagement } from '@/pages/admin/AdminClientManagement';
import { AdminEmployeeManagement } from '@/pages/admin/AdminEmployeeManagement';
import { AdminSettings } from '@/pages/admin/AdminSettings';
import { AdminClientSheets } from '@/pages/admin/AdminClientSheets';
import { Home, ShoppingCart, Users, Briefcase, Settings, FileSpreadsheet, Layers, Store, Building2, Pill } from 'lucide-react';

const adminNavItems: NavItem[] = [
  { key: 'home', label: 'الرئيسية', icon: Home, ...({} as any) },
  { key: 'comparison-comprehensive', label: 'مقارنة الأسعار الشاملة', icon: Layers, ...({} as any) },
  { key: 'wholesale-suppliers', label: 'مخازن وموردين الجملة', icon: Building2, ...({} as any) },
  { key: 'retail-suppliers', label: 'مخازن وموردين القطاعي', icon: Store, ...({} as any) },
  { key: 'pharmacy-suppliers', label: 'مخازن وموردين الصيدليات', icon: Pill, ...({} as any) },
  { key: 'client-sheets', label: 'شيتات العملاء', icon: FileSpreadsheet, ...({} as any) },
  { key: 'orders', label: 'الطلبات', icon: ShoppingCart, ...({} as any) },
  { key: 'clients', label: 'إدارة العملاء', icon: Users, ...({} as any) },
  { key: 'employees', label: 'إدارة الموظفين', icon: Briefcase, ...({} as any) },
  { key: 'settings', label: 'الإعدادات', icon: Settings, ...({} as any) },
];

export function AdminDashboard() {
  const [activePage, setActivePage] = useState('home');

  const renderPage = () => {
    switch (activePage) {
      case 'home': return <AdminHome />;
      case 'comparison-comprehensive': return <AdminComparison />;
      case 'wholesale-suppliers': return <WholesaleSuppliers />;
      case 'retail-suppliers': return <RetailSuppliers />;
      case 'pharmacy-suppliers': return <PharmacySuppliers />;
      case 'client-sheets': return <AdminClientSheets />;
      case 'orders': return <AdminOrders />;
      case 'clients': return <AdminClientManagement />;
      case 'employees': return <AdminEmployeeManagement />;
      case 'settings': return <AdminSettings />;
      default: return <AdminHome />;
    }
  };

  return (
    <DashboardShell items={adminNavItems} activeKey={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardShell>
  );
}