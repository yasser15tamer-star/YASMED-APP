import { useEffect, useState, useCallback } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase, type Profile, type EmployeePermissions } from '@/lib/supabase';
import { AlertCircle, Loader2, Briefcase, Plus, X, Check, Trash2 } from 'lucide-react';

interface EmployeeWithPerms extends Profile {
  permissions?: EmployeePermissions;
}

export function AdminEmployeeManagement() {
  const [employees, setEmployees] = useState<EmployeeWithPerms[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [perms, setPerms] = useState({ can_upload_suppliers: false, can_update_suppliers: false, can_view_orders: false, can_manage_clients: false });
  const [creating, setCreating] = useState(false);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    const { data: empData, error } = await supabase.from('profiles').select('*').eq('role', 'employee').order('created_at', { ascending: false });
    if (error) { setError('فشل في تحميل الموظفين'); setLoading(false); return; }

    const empList = empData || [];
    if (empList.length > 0) {
      const { data: permsData } = await supabase.from('employee_permissions').select('*').in('employee_id', empList.map(e => e.id));
      const permsMap = new Map((permsData || []).map(p => [p.employee_id, p]));
      setEmployees(empList.map(e => ({ ...e, permissions: permsMap.get(e.id) })));
    } else {
      setEmployees([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const handleCreateEmployee = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) { setError('يرجى إدخال جميع البيانات'); return; }
    setCreating(true); setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const response = await fetch(`${supabaseUrl}/functions/v1/create-employee`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({ email: newEmail, password: newPassword, full_name: newName, permissions: perms }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error || 'فشل في إنشاء الموظف'); }
      else {
        setSuccess('تم إنشاء الموظف بنجاح');
        setShowAddModal(false); setNewName(''); setNewEmail(''); setNewPassword('');
        setPerms({ can_upload_suppliers: false, can_update_suppliers: false, can_view_orders: false, can_manage_clients: false });
        fetchEmployees();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch {
      setError('فشل في إنشاء الموظف');
    }
    setCreating(false);
  };

  const handleTogglePerm = async (employeeId: string, permKey: keyof EmployeePermissions, value: boolean) => {
    const { error } = await supabase.from('employee_permissions').update({ [permKey]: value }).eq('employee_id', employeeId);
    if (error) setError('فشل في تحديث الصلاحيات');
    else fetchEmployees();
  };

  const handleToggleEnabled = async (emp: Profile) => {
    const { error } = await supabase.from('profiles').update({ enabled: !emp.enabled }).eq('id', emp.id);
    if (error) setError('فشل في تحديث حالة الموظف');
    else fetchEmployees();
  };

  const permLabels: { key: keyof EmployeePermissions; label: string }[] = [
    { key: 'can_upload_suppliers', label: 'رفع ملفات الموردين' },
    { key: 'can_update_suppliers', label: 'تحديث الملفات' },
    { key: 'can_view_orders', label: 'متابعة الطلبات' },
    { key: 'can_manage_clients', label: 'إدارة العملاء' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800">إدارة الموظفين</h2>
        <Button onClick={() => setShowAddModal(true)}><Plus className="w-4 h-4" /> إضافة موظف</Button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}
      {success && <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm font-medium flex items-center gap-2"><Check className="w-4 h-4 shrink-0" /> {success}</div>}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-teal-600 animate-spin" /></div>
      ) : employees.length === 0 ? (
        <Card><CardBody className="text-center py-12"><Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">لا يوجد موظفين بعد</p></CardBody></Card>
      ) : (
        <div className="space-y-4">
          {employees.map(emp => (
            <Card key={emp.id}>
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${emp.enabled ? 'bg-teal-50' : 'bg-slate-100'}`}>
                      <span className={`text-sm font-bold ${emp.enabled ? 'text-teal-700' : 'text-slate-400'}`}>{emp.full_name.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{emp.full_name}</p>
                      <Badge status={emp.enabled ? 'found' : 'not_found'}>{emp.enabled ? 'مفعل' : 'معطل'}</Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {permLabels.map(({ key, label }) => {
                      const checked = emp.permissions ? (emp.permissions[key] as boolean) : false;
                      return (
                        <button
                          key={key}
                          onClick={() => handleTogglePerm(emp.id, key, !checked)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${checked ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                        >
                          {checked && <Check className="w-3 h-3 inline ml-1" />}{label}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant={emp.enabled ? 'outline' : 'success'} size="sm" onClick={() => handleToggleEnabled(emp)}>
                    {emp.enabled ? 'تعطيل' : 'تفعيل'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Add employee modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">إضافة موظف جديد</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <Input label="الاسم الكامل" placeholder="اسم الموظف" value={newName} onChange={e => setNewName(e.target.value)} />
              <Input label="البريد الإلكتروني" type="email" placeholder="employee@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              <Input label="كلمة المرور" type="password" placeholder="••••••••" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">الصلاحيات</p>
                <div className="space-y-2">
                  {permLabels.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={perms[key as keyof typeof perms] as boolean} onChange={e => setPerms({ ...perms, [key]: e.target.checked })} className="w-4 h-4 rounded accent-teal-600" />
                      <span className="text-sm text-slate-600">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              {error && <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">{error}</div>}
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>إلغاء</Button>
              <Button className="flex-1" onClick={handleCreateEmployee} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} إنشاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
