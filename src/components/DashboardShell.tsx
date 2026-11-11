import { type ReactNode, useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar, type NavItem } from '@/components/Sidebar';
import { useAuth } from '@/context/AuthContext';

export type { NavItem };

interface DashboardShellProps {
  items: NavItem[];
  activeKey: string;
  onNavigate: (key: string) => void;
  children: ReactNode;
  storeName?: string;
}

const STORAGE_KEY = 'sidebar-open';
const DESKTOP_MIN = 1024; // نفس breakpoint بتاع lg في Tailwind

const isDesktop = () => typeof window !== 'undefined' && window.innerWidth >= DESKTOP_MIN;

export function DashboardShell({ items, activeKey, onNavigate, children, storeName = 'YASMED - ياسمد' }: DashboardShellProps) {
  const { profile, signOut } = useAuth();

  // الكمبيوتر: بيفتكر آخر حالة. الموبايل: دايمًا مقفولة في الأول.
  const [open, setOpen] = useState<boolean>(() => {
    if (!isDesktop()) return false;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });

  // احفظ الحالة (على الكمبيوتر بس)
  useEffect(() => {
    if (!isDesktop()) return;
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch { /* ignore */ }
  }, [open]);

  // اقفل القائمة بزر Escape (للموبايل)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDesktop()) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // على الموبايل: القائمة تتقفل لما تختار صفحة
  const handleNavigate = (key: string) => {
    onNavigate(key);
    if (!isDesktop()) setOpen(false);
  };

  const roleLabel =
    profile?.role === 'admin' ? 'مدير النظام' :
    profile?.role === 'employee' ? 'موظف' :
    'عميل';

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
      <Sidebar
        items={items}
        activeKey={activeKey}
        onSelect={handleNavigate}
        fullName={profile?.full_name || ''}
        roleLabel={roleLabel}
        onSignOut={signOut}
        storeName={storeName}
        open={open}
        onClose={() => setOpen(false)}
      />

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* شريط علوي فيه زر القائمة ☰ */}
        <div className="sticky top-0 z-30 bg-slate-50/90 backdrop-blur border-b border-slate-200/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={open}
              className="flex items-center justify-center w-10 h-10 rounded-xl text-slate-600 hover:bg-white hover:text-teal-600 hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>
            {!open && (
              <span className="text-sm font-bold text-slate-700 truncate">{storeName}</span>
            )}
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}