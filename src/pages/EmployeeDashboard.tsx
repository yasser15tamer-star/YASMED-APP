import { useState, useEffect, useCallback } from 'react';
import { DashboardShell, type NavItem } from '@/components/DashboardShell';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { supabase, type ClientProduct, type EmployeePermissions, type Order } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Home, Store, Package, ShoppingCart, Search, AlertCircle, Loader2, X } from 'lucide-react';

export function EmployeeDashboard() {
  const { profile } = useAuth();
  const [activePage, setActivePage] = useState('home');
  const [permissions, setPermissions] = useState<EmployeePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    supabase.from('employee_permissions').select('*').eq('employee_id', profile.id).maybeSingle().then(({ data }) => {
      setPermissions(data);
      setLoading(false);
    });
  }, [profile]);

  // Build nav items based on permissions
  const navItems: NavItem[] = [{ key: 'home', label: 'الرئيسية', icon: Home }];
  if (permissions?.can_upload_suppliers || permissions?.can_update_suppliers) {
    navItems.push({ key: 'suppliers', label: 'ملفات الموردين', icon: Store });
  }
  if (permissions?.can_view_orders) {
    navItems.push({ key: 'orders', label: 'الطلبات', icon: ShoppingCart });
  }

  const renderPage = () => {
    switch (activePage) {
      case 'home': return <EmployeeHome permissions={permissions} />;
      case 'suppliers': return <EmployeeSuppliers canUpdate={permissions?.can_update_suppliers || false} />;
      case 'orders': return <EmployeeOrders />;
      default: return <EmployeeHome permissions={permissions} />;
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>;

  return (
    <DashboardShell items={navItems} activeKey={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </DashboardShell>
  );
}

function EmployeeHome({ permissions }: { permissions: EmployeePermissions | null }) {
  const { profile } = useAuth();
  const permLabels = [
    { key: 'can_upload_suppliers', label: 'رفع ملفات الموردين' },
    { key: 'can_update_suppliers', label: 'تحديث الملفات' },
    { key: 'can_view_orders', label: 'متابعة الطلبات' },
    { key: 'can_manage_clients', label: 'إدارة العملاء' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-1">أهلاً وسهلاً بك، {profile?.full_name}</h2>
      <p className="text-sm text-slate-500 mb-6">لوحة الموظف</p>

      <Card className="mb-6">
        <CardBody>
          <h3 className="text-lg font-bold text-slate-800 mb-4">صلاحياتك</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {permLabels.map(({ key, label }) => {
              const has = permissions ? (permissions[key as keyof EmployeePermissions] as boolean) : false;
              return (
                <div key={key} className={`px-4 py-3 rounded-xl border flex items-center gap-2 ${has ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`w-2 h-2 rounded-full ${has ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  <span className={`text-sm font-medium ${has ? 'text-emerald-700' : 'text-slate-400'}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function EmployeeSuppliers({ canUpdate }: { canUpdate: boolean }) {
  const [suppliers, setSuppliers] = useState<{ id: string; alias_name: string }[]>([]);
  const [products, setProducts] = useState<ClientProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [showProducts, setShowProducts] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: supplierData, error: supplierError } = await supabase.from('supplier_aliases').select('*').order('alias_name');
    if (supplierError) { setError('فشل في تحميل الموردين'); setLoading(false); return; }
    setSuppliers(supplierData || []);

    const { data: productData, error: productError } = await supabase.from('client_products').select('*').order('product_name');
    if (productError) setError('فشل في تحميل المنتجات');
    else setProducts(productData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredProducts = selectedSupplier ? products.filter(p => p.supplier_id === selectedSupplier) : products;
  const searchedProducts = search ? filteredProducts.filter(p => p.product_name.includes(search)) : filteredProducts;

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">ملفات الموردين</h2>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center"><Store className="w-6 h-6 text-teal-600" /></div><div><p className="text-2xl font-bold text-slate-800">{suppliers.length}</p><p className="text-sm text-slate-500">الموردين</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center"><Package className="w-6 h-6 text-blue-600" /></div><div><p className="text-2xl font-bold text-slate-800">{products.length}</p><p className="text-sm text-slate-500">المنتجات</p></div></CardBody></Card>
      </div>

      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div> :
        suppliers.length === 0 ? <Card><CardBody className="text-center py-12"><Store className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">لا يوجد موردين</p></CardBody></Card> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map(supplier => {
              const count = products.filter(p => p.supplier_id === supplier.id).length;
              return (
                <Card key={supplier.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardBody onClick={() => { setSelectedSupplier(supplier.id); setShowProducts(true); }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center"><Store className="w-5 h-5 text-teal-600" /></div>
                      <div className="flex-1"><p className="font-bold text-slate-800">{supplier.alias_name}</p><p className="text-xs text-slate-400">{count} منتج</p></div>
                      <Badge status="default">{count}</Badge>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      }

      {showProducts && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setShowProducts(false); setSelectedSupplier(null); }}>
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div><h3 className="text-lg font-bold text-slate-800">منتجات المورد</h3><p className="text-sm text-slate-500">{suppliers.find(s => s.id === selectedSupplier)?.alias_name}</p></div>
              <button onClick={() => { setShowProducts(false); setSelectedSupplier(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-3 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pr-10 pl-4 py-2 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20" />
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {searchedProducts.length === 0 ? <div className="text-center py-8"><Package className="w-10 h-10 text-slate-300 mx-auto mb-2" /><p className="text-slate-500">لا توجد منتجات</p></div> : (
                <div className="rounded-xl border border-slate-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0"><tr><th className="text-right p-3 font-semibold text-slate-600">المنتج</th><th className="text-right p-3 font-semibold text-slate-600">السعر</th><th className="text-right p-3 font-semibold text-slate-600">الخصم</th><th className="text-right p-3 font-semibold text-slate-600">النهائي</th><th className="text-right p-3 font-semibold text-slate-600">الكمية</th></tr></thead>
                    <tbody>
                      {searchedProducts.map(p => (
                        <tr key={p.id} className="border-t border-slate-50"><td className="p-3 text-slate-700">{p.product_name}</td><td className="p-3 text-slate-600">{p.price}</td><td className="p-3 text-slate-600">{p.discount}%</td><td className="p-3 text-slate-600 font-semibold">{p.final_price.toFixed(2)}</td><td className="p-3 text-slate-600">{p.quantity}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل الطلبات');
    else setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const statusLabels: Record<string, string> = { pending: 'قيد الانتظار', processing: 'قيد المعالجة', completed: 'مكتمل', cancelled: 'ملغي' };
  const statusBadgeMap: Record<string, 'found' | 'similar' | 'not_found' | 'default'> = { pending: 'similar', processing: 'default', completed: 'found', cancelled: 'not_found' };

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-800 mb-6">الطلبات</h2>
      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div> :
        orders.length === 0 ? <Card><CardBody className="text-center py-12"><ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">لا توجد طلبات</p></CardBody></Card> : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50"><tr><th className="text-right p-3 font-semibold text-slate-600">العميل</th><th className="text-right p-3 font-semibold text-slate-600">المنتج</th><th className="text-right p-3 font-semibold text-slate-600">الكمية</th><th className="text-right p-3 font-semibold text-slate-600">المورد</th><th className="text-right p-3 font-semibold text-slate-600">السعر النهائي</th><th className="text-right p-3 font-semibold text-slate-600">التاريخ</th><th className="text-right p-3 font-semibold text-slate-600">الحالة</th></tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-t border-slate-50"><td className="p-3 text-slate-700">{o.client_name}</td><td className="p-3 text-slate-600">{o.product_name}</td><td className="p-3 text-slate-600">{o.quantity}</td><td className="p-3 text-slate-600">{o.supplier_alias}</td><td className="p-3 text-slate-600 font-semibold">{o.final_price.toFixed(2)}</td><td className="p-3 text-slate-500 text-xs">{new Date(o.created_at).toLocaleDateString('ar-EG')}</td><td className="p-3"><Badge status={statusBadgeMap[o.status]}>{statusLabels[o.status]}</Badge></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      }
    </div>
  );
}
