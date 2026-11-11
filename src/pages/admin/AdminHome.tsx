import { useEffect, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Store, Package, ShoppingCart, Users, Briefcase, TrendingUp, Clock } from 'lucide-react';

export function AdminHome() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ suppliers: 0, products: 0, orders: 0, clients: 0, employees: 0, pendingOrders: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: suppliers }, { count: products }, { count: orders }, { count: clients }, { count: employees }, { count: pending }] = await Promise.all([
        supabase.from('suppliers').select('*', { count: 'exact', head: true }),
        supabase.from('supplier_products').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'employee'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);
      setStats({
        suppliers: suppliers || 0,
        products: products || 0,
        orders: orders || 0,
        clients: clients || 0,
        employees: employees || 0,
        pendingOrders: pending || 0,
      });
    })();
  }, []);

  const cards = [
    { icon: Store, label: 'الموردين', value: stats.suppliers, color: 'teal' },
    { icon: Package, label: 'المنتجات', value: stats.products, color: 'blue' },
    { icon: ShoppingCart, label: 'الطلبات', value: stats.orders, color: 'amber' },
    { icon: TrendingUp, label: 'طلبات معلقة', value: stats.pendingOrders, color: 'red' },
    { icon: Users, label: 'العملاء', value: stats.clients, color: 'emerald' },
    { icon: Briefcase, label: 'الموظفين', value: stats.employees, color: 'slate' },
  ];

  const colorMap: Record<string, string> = {
    teal: 'bg-teal-50 text-teal-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    slate: 'bg-slate-100 text-slate-600',
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">أهلاً وسهلاً بك، {profile?.full_name}</h2>
      <p className="text-sm text-slate-500 mb-6">لوحة تحكم الإدارة - نظرة عامة على النظام</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <Card key={i}>
              <CardBody className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[card.color]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-800">{card.value}</p>
                  <p className="text-sm text-slate-500">{card.label}</p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardBody>
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-teal-600" />
            <h3 className="text-lg font-bold text-slate-800">إجراءات سريعة</h3>
          </div>
          <p className="text-sm text-slate-500">
            استخدم القائمة الجانبية للتنقل بين الأقسام. يمكنك إدارة الموردين، متابعة الطلبات، إدارة العملاء والموظفين، وتعديل الإعدادات.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
