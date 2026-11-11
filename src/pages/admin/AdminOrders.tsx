import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { supabase, type Order } from '@/lib/supabase';
import {
  AlertCircle,
  Loader2,
  ShoppingCart,
  Search,
  Trash2,
  Printer,
  Settings2,
  MoreVertical,
  ChevronDown,
  Truck,
  X,
  Users,
  Wallet,
  Clock,
  Package,
  Building2,
} from 'lucide-react';

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled';
type PrintMode = 'both' | 'purchase' | 'sales';

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  processing: 'قيد المعالجة',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const statusOptions = ['pending', 'processing', 'completed', 'cancelled'] as const;

const statusSelectStyles: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  processing: 'bg-sky-50 text-sky-700 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};

const money = (n: number) =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const pad = (n: number) => String(n).padStart(2, '0');

// final_price هو سعر الوحدة بعد الخصم (مثال: 27 - 33% = 18.09)، فإجمالي السطر = سعر الوحدة × الكمية
const lineTotal = (o: Order) => (o.final_price || 0) * (o.quantity || 0);

// أدوات عرض اسم العميل (للشاشة فقط — الاسم الأصلي في قاعدة البيانات بيفضل زي ما هو)
// مثال: "ياسر تامر [مخزن جملة - ترخيص: 5555555]"
//   الاسم: "ياسر تامر"   |   النوع: "مخزن جملة"   |   الترخيص: مخفي
const clientBase = (name: string) => name.replace(/\s*\[.*$/, '').trim() || name;
const clientType = (name: string) => {
  const m = name.match(/\[\s*([^\]\-–—]+)/);
  return m ? m[1].trim() : '';
};

// لون الشريط الجانبي لكل كارت عميل حسب الحالة
const statusAccent: Record<string, string> = {
  pending: 'border-r-amber-400',
  processing: 'border-r-sky-500',
  completed: 'border-r-emerald-500',
  cancelled: 'border-r-red-400',
};

interface OrderGroup {
  client: string;
  orders: Order[];
  total: number;
  suppliers: string[];
}

interface PrintMeta {
  date: string; // 2026/11/04
  time: string; // 07:29 ص
  stamp: string; // 20261104072948
  seq: number;
}

interface InvoiceData {
  kind: 'purchase' | 'sales';
  title: string;
  brand: string; // الاسم الظاهر أعلى الفاتورة (مكان "ياسر")
  subtitle: string;
  partyName: string; // قيمة خانة "المورد"
  number: string;
  orders: Order[];
  clientDetails?: Order;
}

interface InfoCell {
  label: string;
  value: string;
  span?: number; // عدد الأعمدة من 6 (الافتراضي 2 = ثلث الصف)
  ltr?: boolean;
  icon: React.ReactNode;
}

function makeMeta(): PrintMeta {
  const d = new Date();
  const h = d.getHours();
  return {
    date: `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`,
    time: `${pad(h % 12 === 0 ? 12 : h % 12)}:${pad(d.getMinutes())} ${h < 12 ? 'ص' : 'م'}`,
    stamp: `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(h)}${pad(d.getMinutes())}${pad(d.getSeconds())}`,
    seq: Math.floor(Math.random() * 900) + 100,
  };
}

function groupBy(list: Order[], keyFn: (o: Order) => string): [string, Order[]][] {
  const map = new Map<string, Order[]>();
  list.forEach(o => {
    const k = keyFn(o);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(o);
  });
  return Array.from(map.entries());
}

/* ------------------------------------------------------------------ */
/*  Invoice page (same design for purchase & sales)                    */
/* ------------------------------------------------------------------ */
function Ico({ children, size = 26 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#14449a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function Logo({ size = 76 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 14 L32 3 L46 14" fill="none" stroke="#14449a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="25" y="12" width="5" height="5" rx="1" fill="#14449a" />
      <rect x="32" y="12" width="5" height="5" rx="1" fill="#14449a" />
      <path d="M20 38 C13 28 18 17 32 17 C32 28 28 36 20 38Z" fill="#7ac143" />
      <path d="M44 38 C51 28 46 17 32 17 C32 28 36 36 44 38Z" fill="#4f9a2a" />
      <path d="M8 38 H56 C56 52 46 60 32 60 C18 60 8 52 8 38Z" fill="#14449a" />
      <path d="M48 36 L60 16" stroke="#14449a" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

function InvoicePage({ inv, meta }: { inv: InvoiceData; meta: PrintMeta }) {
  const itemsCount = inv.orders.length;
  const total = inv.orders.reduce((s, o) => s + lineTotal(o), 0);
  const totalDiscount = inv.orders.reduce(
    (s, o) => s + ((o.price || 0) * (o.quantity || 0) - lineTotal(o)),
    0
  );

  const cd = inv.clientDetails;

  const legalIcon = (
    <Ico>
      <path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h4" />
    </Ico>
  );

  const info: InfoCell[] = [
    {
      label: 'المورد',
      value: inv.partyName,
      icon: (
        <Ico>
          <rect x="5" y="3" width="10" height="18" rx="1" />
          <path d="M15 9h4v12h-4M8 7h4M8 11h4M8 15h4" />
        </Ico>
      ),
    },
    {
      label: 'رقم الفاتورة',
      value: inv.number,
      ltr: true,
      icon: (
        <Ico>
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M15 3v4h4M9 13h7M9 17h7" />
        </Ico>
      ),
    },
    {
      label: 'التاريخ والوقت',
      value: `${meta.date}  -  ${meta.time}`,
      icon: (
        <Ico>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4M8 14h2M12 14h2M16 14h2M8 17h2M12 17h2M16 17h2" />
        </Ico>
      ),
    },
    ...(inv.kind === 'sales' && cd
      ? [
          {
            label: 'العميل',
            value: (() => {
              const n = cd.client_name || '';
              if (!n) return 'غير متوفر';
              const ty = clientType(n);
              return ty ? `${clientBase(n)} (${ty})` : clientBase(n);
            })(),
            icon: <Ico><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c.8-4 3.5-6 8-6s7.2 2 8 6" /></Ico>,
          },
          {
            label: 'التواصل',
            value:
              cd.client_contact_numbers?.map(c => `${c.label}: ${c.number}`).join(' | ') || 'غير متوفر',
            icon: <Ico><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Ico>,
          },
          {
            label: 'العنوان',
            value:
              [cd.client_province, cd.client_city, cd.client_address].filter(Boolean).join(' - ') ||
              'غير متوفر',
            icon: <Ico><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2" /></Ico>,
          },
          // البيانات القانونية: كل رقم في خانة لوحده، وتظهر بس الموجودة
          ...(cd.client_license_number
            ? [{ label: 'رقم الترخيص', value: String(cd.client_license_number), ltr: true, icon: legalIcon }]
            : []),
          ...(cd.client_tax_number
            ? [{ label: 'الرقم الضريبي', value: String(cd.client_tax_number), ltr: true, icon: legalIcon }]
            : []),
          ...(cd.client_commercial_record
            ? [{ label: 'السجل التجاري', value: String(cd.client_commercial_record), ltr: true, icon: legalIcon }]
            : []),
        ]
      : []),
  ];

  return (
    <div className="inv-page">
      {/* ---------- Header ---------- */}
      <div className="inv-header">
        <svg className="inv-header-bg" viewBox="0 0 794 200" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="hdrLight" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e8f0fb" />
              <stop offset="1" stopColor="#f7fafe" />
            </linearGradient>
            <linearGradient id="hdrNavy" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#0b2a6b" />
              <stop offset="1" stopColor="#1a53b0" />
            </linearGradient>
          </defs>
          <rect width="794" height="200" fill="url(#hdrLight)" />
          <path d="M0 150 C120 170 250 190 380 188 C560 186 700 150 794 118 L794 200 L0 200 Z" fill="url(#hdrNavy)" />
          <path d="M0 132 C140 160 290 168 430 160 C600 150 720 110 794 84" fill="none" stroke="#7ac143" strokeWidth="4" strokeLinecap="round" />
          <path d="M794 0 L794 96 C770 70 764 30 794 0Z" fill="#14449a" />
        </svg>

        <div className="inv-brand">
          <Logo />
          <div className="inv-brand-name">{inv.brand}</div>
        </div>

        <div className="inv-tagline">
          <div className="inv-tagline-1">معاً ..</div>
          <div className="inv-tagline-2">نبني مستقبل أفضل</div>
          <div className="inv-heart">
            <span />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#14449a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
              <path d="M7 11h3l1.5-2.5L13 13l1-2h3" />
            </svg>
            <span />
          </div>
        </div>
      </div>

      {/* ---------- Title ---------- */}
      <div className="inv-title-wrap">
        <div className="inv-title">
          <div className="inv-title-icon">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M15 3v4h4M9 12h7M9 16h7" />
            </svg>
          </div>
          <span>{inv.title}</span>
        </div>
        <div className="inv-subtitle">{inv.subtitle}</div>
      </div>

      {/* ---------- Info ---------- */}
      <div className="inv-info">
        {info.map(c => (
          <div
            className="inv-cell"
            style={{ gridColumn: `span ${c.span || 2}` }}
            key={c.label}
          >
            <div className="inv-cell-icon">{c.icon}</div>
            <div className="inv-cell-text">
              <b>{c.label}</b>
              <span dir={c.ltr ? 'ltr' : undefined} style={c.ltr ? { textAlign: 'right' } : undefined}>
                {c.value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Items ---------- */}
      <table className="inv-table">
        <thead>
          <tr>
            <th style={{ width: '5%' }}>#</th>
            <th style={{ width: '32%' }}>الصنف</th>
            <th style={{ width: '9%' }}>الكمية</th>
            <th>سعر الشراء</th>
            <th>خصم</th>
            <th>سعر بعد الخصم</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {inv.orders.map((o, i) => (
            <tr key={o.id}>
              <td className="inv-bold">{i + 1}</td>
              <td className="inv-bold inv-name-cell">{o.product_name}</td>
              <td>{o.quantity}</td>
              <td>{money(o.price || 0)}</td>
              <td>{money(o.discount || 0)}%</td>
              <td>{money(o.final_price || 0)}</td>
              <td className="inv-bold">{money(lineTotal(o))} ج.م</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ---------- Notes + Summary ---------- */}
      <div className="inv-bottom">
        <div className="inv-notes">
          <div className="inv-notes-head">
            <Ico size={30}>
              <path d="M6 3h9l4 4v14H6z" />
              <path d="M15 3v4h4M9 12h7M9 16h7" />
            </Ico>
            <span>ملاحظات</span>
          </div>
          <p>{inv.brand} يرحب بكم دائماً</p>
          <p>مع أطيب التمنيات بدوام الصحة والعافية</p>
          <svg className="inv-notes-wave" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 30 C60 10 120 10 180 24 C230 34 270 22 300 12" fill="none" stroke="#14449a" strokeWidth="3" />
            <path d="M0 36 C70 20 130 20 190 30 C240 38 275 30 300 22" fill="none" stroke="#7ac143" strokeWidth="3" />
          </svg>
        </div>

        <div className="inv-summary">
          <div className="inv-sum-row">
            <span className="inv-sum-label">
              <Ico size={24}>
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
                <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
              </Ico>
              إجمالي الأصناف
            </span>
            <b>{itemsCount}</b>
          </div>
          <div className="inv-sum-row">
            <span className="inv-sum-label">
              <span className="inv-pct">%</span>
              إجمالي الخصم
            </span>
            <b>{money(totalDiscount)}</b>
          </div>
          <div className="inv-total">
            <span className="inv-sum-label">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                <ellipse cx="12" cy="6" rx="7" ry="3" />
                <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
              </svg>
              إجمالي الفاتورة
            </span>
            <b>ج.م {money(total)}</b>
          </div>
        </div>
      </div>

      {/* ---------- Stamp + Signature ---------- */}
      <div className="inv-sign">
        <div className="inv-sign-box">
          <span className="inv-sign-label">الختم</span>
        </div>
        <div className="inv-sign-box">
          <span className="inv-sign-label">الإمضاء</span>
        </div>
      </div>

      {/* ---------- Footer ---------- */}
      <div className="inv-footer">
        <svg className="inv-footer-wave" viewBox="0 0 794 40" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 22 C160 4 330 6 500 20 C640 32 730 22 794 10 L794 40 L0 40 Z" fill="#0b2a6b" />
          <path d="M0 22 C160 4 330 6 500 20 C640 32 730 22 794 10" fill="none" stroke="#7ac143" strokeWidth="5" />
        </svg>
        <div className="inv-footer-body">
          <div className="inv-footer-row">
            <div className="inv-footer-brand">
              <div className="inv-footer-logo"><Logo size={40} /></div>
              <div>
                <div className="inv-footer-yas">YASMED</div>
                <div className="inv-footer-sub">Your Pharmacy Partner</div>
              </div>
            </div>
            <div className="inv-footer-phone">
              <div className="inv-footer-circle">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                </svg>
              </div>
              <div>
                <div className="inv-footer-small">يمكنك التواصل معنا على الرقم التالي</div>
                <b dir="ltr">01013629789</b>
              </div>
            </div>
            <div className="inv-footer-addr">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" />
              </svg>
              <span>الدقهلية - المنصورة - مصر</span>
            </div>
            <div className="inv-footer-slogan">
              <div>معاً ... لنحقق</div>
              <div>الأفضل</div>
            </div>
          </div>
          <div className="inv-footer-rights">
            جميع الحقوق محفوظة لياسمد تحت إشراف أ/ ياسر تامر محمد السعيد
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showPrintSettings, setShowPrintSettings] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ order: Order; top: number; left: number } | null>(null);

  // Print settings controlled by the admin
  // الاسم الظاهر أعلى الفواتير (شراء وبيع) - بيتحفظ في المتصفح ومش بيتغير غير لما تغيره
  const [invoiceName, setInvoiceName] = useState<string>(() => {
    try { return localStorage.getItem('invoice_brand_name') || 'الجوهري'; } catch { return 'الجوهري'; }
  });
  const [customClientName, setCustomClientName] = useState(''); // اختياري: يستبدل اسم العميل في فاتورة البيع
  const [printMode, setPrintMode] = useState<PrintMode>('both');
  const [printOrders, setPrintOrders] = useState<Order[] | null>(null);
  const [printMeta, setPrintMeta] = useState<PrintMeta | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) setError('فشل في تحميل الطلبات');
    else setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    try { localStorage.setItem('invoice_brand_name', invoiceName); } catch { /* ignore */ }
  }, [invoiceName]);

  // ---------- Single-order actions ----------
  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) setError('فشل في تحديث حالة الطلب');
    else fetchOrders();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) setError('فشل في حذف الطلب');
    else {
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
      fetchOrders();
    }
  };

  // ---------- Bulk actions ----------
  const bulkStatus = async (list: Order[], status: string, scopeLabel: string) => {
    const ids = list.filter(o => o.status !== status).map(o => o.id);
    if (ids.length === 0) return;
    if (!window.confirm(`تغيير حالة ${ids.length} طلب (${scopeLabel}) إلى "${statusLabels[status]}"؟`)) return;
    setBusy(true);
    const { error } = await supabase.from('orders').update({ status }).in('id', ids);
    if (error) setError('فشل في تحديث حالة الطلبات');
    else {
      setError(null);
      setSelected(new Set());
      await fetchOrders();
    }
    setBusy(false);
  };

  const bulkDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`هل أنت متأكد من حذف ${ids.length} طلب؟ لا يمكن التراجع.`)) return;
    setBusy(true);
    const { error } = await supabase.from('orders').delete().in('id', ids);
    if (error) setError('فشل في حذف الطلبات');
    else {
      setError(null);
      setSelected(new Set());
      await fetchOrders();
    }
    setBusy(false);
  };

  // ---------- Printing (purchase + sales invoices) ----------
  const handlePrint = (list: Order[]) => {
    if (list.length === 0) return;
    setPrintMeta(makeMeta());
    setPrintOrders(list);
    setTimeout(() => window.print(), 250);
  };

  // Build the invoices to print
  const invoices: InvoiceData[] = useMemo(() => {
    if (!printOrders || printOrders.length === 0 || !printMeta) return [];
    const list: InvoiceData[] = [];
    const brandName = invoiceName.trim() || 'الجوهري';

    // فواتير الشراء: فاتورة لكل مورد حقيقي، والاسم الظاهر فوق هو الاسم المستعار
    if (printMode === 'both' || printMode === 'purchase') {
      groupBy(printOrders, o => (o.supplier_real_name || 'غير محدد').trim()).forEach(([real, os], i) => {
        list.push({
          kind: 'purchase',
          title: 'فـاتورة مشتريات',
          brand: brandName,
          subtitle: `من مخزن ${real}`,
          partyName: real,
          number: `PO-${printMeta.stamp}-${printMeta.seq + i}`,
          orders: os,
        });
      });
    }

    // فواتير البيع: فاتورة لكل عميل، والاسم فوق هو اسم مخزنك
    if (printMode === 'both' || printMode === 'sales') {
      const byClient = groupBy(printOrders, o => (o.client_name || 'بدون اسم').trim());
      byClient.forEach(([client, os], i) => {
        const shownClient = byClient.length === 1 && customClientName.trim() ? customClientName.trim() : clientBase(client);
        list.push({
          kind: 'sales',
          title: 'فـاتورة مبيعات',
          brand: brandName,
          subtitle: `إلى ${shownClient}`,
          partyName: brandName,
          number: `SO-${printMeta.stamp}-${printMeta.seq + 50 + i}`,
          orders: os,
          clientDetails: os[0],
        });
      });
    }
    return list;
  }, [printOrders, printMeta, printMode, invoiceName, customClientName]);

  // ---------- Data ----------
  const filteredOrders = useMemo(
    () =>
      orders.filter(o => {
        if (statusFilter !== 'all' && o.status !== statusFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            o.client_name.toLowerCase().includes(q) ||
            o.product_name.toLowerCase().includes(q) ||
            o.supplier_real_name.toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [orders, search, statusFilter]
  );

  const groups: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();
    filteredOrders.forEach(o => {
      const key = (o.client_name || 'بدون اسم').trim();
      if (!map.has(key)) map.set(key, { client: key, orders: [], total: 0, suppliers: [] });
      const g = map.get(key)!;
      g.orders.push(o);
      g.total += lineTotal(o);
      if (o.supplier_real_name && !g.suppliers.includes(o.supplier_real_name)) {
        g.suppliers.push(o.supplier_real_name);
      }
    });
    return Array.from(map.values());
  }, [filteredOrders]);

  const selectedOrders = useMemo(() => orders.filter(o => selected.has(o.id)), [orders, selected]);

  const toggleGroup = (client: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(client)) next.delete(client);
      else next.add(client);
      return next;
    });
  };

  const allCollapsed = groups.length > 0 && groups.every(g => collapsed.has(g.client));
  const toggleAllGroups = () => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(g => g.client)));

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupSelection = (g: OrderGroup) => {
    setSelected(prev => {
      const next = new Set(prev);
      const all = g.orders.every(o => next.has(o.id));
      g.orders.forEach(o => (all ? next.delete(o.id) : next.add(o.id)));
      return next;
    });
  };

  const openMenu = (e: React.MouseEvent<HTMLButtonElement>, order: Order) => {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ order, top: r.bottom + 4, left: Math.max(8, r.left) });
  };

  const grandTotal = filteredOrders.reduce((s, o) => s + lineTotal(o), 0);
  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className={selected.size > 0 ? 'pb-24' : ''}>
      {/* Print-specific styles */}
      <style>{`
        @page { size: A4; margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #printable-invoice, #printable-invoice * { visibility: visible; }
          #printable-invoice {
            position: absolute; left: 0; top: 0; width: 100%;
            direction: rtl; background: white;
          }
        }
        #printable-invoice, #printable-invoice * {
          -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box;
        }
        .inv-page {
          width: 210mm; min-height: 296mm; margin: 0 auto; background: #fff; color: #0b2a6b;
          display: flex; flex-direction: column; direction: rtl; position: relative; overflow: hidden;
          page-break-after: always; break-after: page;
        }
        .inv-page:last-child { page-break-after: auto; break-after: auto; }

        /* Header */
        .inv-header { position: relative; height: 156px; flex-shrink: 0; }
        .inv-header-bg { position: absolute; inset: 0; width: 100%; height: 100%; }
        .inv-brand {
          position: absolute; top: 14px; right: 34px; width: 190px; display: flex; flex-direction: column;
          align-items: center; gap: 2px; padding: 8px 10px 4px; background: rgba(255,255,255,.92);
          border-radius: 14px;
        }
        .inv-brand-name { font-size: 30px; font-weight: 900; color: #0b2a6b; line-height: 1.15; text-align: center; max-width: 100%; word-break: break-word; }
        .inv-tagline { position: absolute; top: 26px; left: 40px; text-align: center; color: #14449a; font-style: italic; }
        .inv-tagline-1 { font-size: 26px; font-weight: 900; line-height: 1.2; }
        .inv-tagline-2 { font-size: 24px; font-weight: 900; line-height: 1.3; }
        .inv-heart { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
        .inv-heart span { flex: 1; height: 2px; background: #14449a; min-width: 60px; }

        /* Title */
        .inv-title-wrap { margin-top: -38px; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 2; flex-shrink: 0; }
        .inv-title {
          background: linear-gradient(135deg, #0b2a6b, #14449a); color: #fff; border-radius: 48px;
          padding: 10px 26px 10px 54px; font-size: 36px; font-weight: 900; display: flex; align-items: center; gap: 16px;
          box-shadow: 0 6px 16px rgba(11, 42, 107, .3); border: 3px solid #fff; outline: 2px solid #cfdcf0;
        }
        .inv-title-icon { width: 50px; height: 50px; border: 2.5px solid #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .inv-subtitle {
          margin-top: -8px; padding: 14px 44px 8px; background: #f3f7fd; border: 1px solid #cfdcf0; border-top: 0;
          border-radius: 0 0 26px 26px; font-weight: 900; font-size: 18px; color: #0b2a6b; z-index: -1; position: relative;
          box-shadow: 0 3px 8px rgba(11, 42, 107, .12);
        }

        /* Info */
        .inv-info {
          margin: 12px 24px 0; display: grid; grid-template-columns: repeat(6, 1fr); gap: 7px;
          padding: 10px; border: 1px solid #cfdcf0; border-radius: 18px; background: #fafcff; flex-shrink: 0;
        }
        .inv-cell { background: #eef4fb; border-radius: 12px; padding: 7px 12px; display: flex; align-items: center; gap: 10px; min-width: 0; }
        .inv-cell-icon { flex-shrink: 0; display: flex; }
        .inv-cell-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
        .inv-cell-text b { font-size: 15px; color: #0b2a6b; font-weight: 900; }
        .inv-cell-text span {
          font-size: 12.5px; color: #3d5282; font-weight: 700;
          overflow-wrap: anywhere; word-break: normal; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }

        /* Table */
        .inv-table {
          margin: 10px 24px 0; width: calc(100% - 48px); border-collapse: separate; border-spacing: 0;
          border: 1px solid #cfdcf0; border-radius: 16px; overflow: hidden; flex-shrink: 0;
        }
        .inv-table th {
          background: linear-gradient(135deg, #0b2a6b, #14449a); color: #fff; padding: 9px 6px;
          font-size: 14px; font-weight: 800; text-align: center; border-left: 1px solid rgba(255,255,255,.22);
        }
        .inv-table th:last-child { border-left: 0; }
        .inv-table td {
          padding: 8px 6px; font-size: 13.5px; text-align: center; color: #1e3a6e; font-weight: 600;
          border-top: 1px solid #e3ebf7; border-left: 1px solid #e3ebf7;
        }
        .inv-table td:last-child { border-left: 0; }
        .inv-table tbody tr:nth-child(even) td { background: #f6f9fe; }
        .inv-table tr { break-inside: avoid; page-break-inside: avoid; }
        .inv-bold { font-weight: 900 !important; color: #0b2a6b !important; }
        .inv-name-cell { text-align: right !important; padding-right: 14px !important; }

        /* Notes + Summary */
        .inv-bottom { margin: 10px 24px 0; display: flex; gap: 16px; align-items: stretch; break-inside: avoid; flex-shrink: 0; }
        .inv-notes {
          flex: 1; border: 1px solid #cfdcf0; border-radius: 18px; padding: 16px 18px 46px; background: #f7faff;
          text-align: center; position: relative; overflow: hidden;
        }
        .inv-notes-head { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 900; margin-bottom: 12px; }
        .inv-notes p { margin: 8px 0; font-size: 14.5px; font-weight: 700; color: #3d5282; }
        .inv-notes-wave { position: absolute; left: 0; right: 0; bottom: 0; width: 100%; height: 40px; }
        .inv-summary { flex: 1; border: 1px solid #cfdcf0; border-radius: 18px; padding: 12px; background: #f7faff; display: flex; flex-direction: column; gap: 8px; }
        .inv-sum-row {
          background: #eaf1fb; border-radius: 12px; padding: 9px 14px; display: flex; justify-content: space-between;
          align-items: center; font-size: 16px; font-weight: 900; color: #0b2a6b;
        }
        .inv-sum-label { display: flex; align-items: center; gap: 10px; }
        .inv-pct { font-size: 26px; font-weight: 900; color: #14449a; line-height: 1; width: 24px; text-align: center; }
        .inv-total {
          background: linear-gradient(135deg, #0b2a6b, #14449a); color: #fff; border-radius: 14px; padding: 12px 16px;
          display: flex; justify-content: space-between; align-items: center; font-size: 19px; font-weight: 900; margin-top: auto;
        }
        .inv-total b { font-size: 28px; }

        /* Stamp + Signature */
        .inv-sign { margin: 10px 24px 0; display: flex; gap: 16px; flex-shrink: 0; break-inside: avoid; }
        .inv-sign-box { flex: 1; height: 58px; border: 1.5px dashed #9fb4d9; border-radius: 16px; background: #fafcff; position: relative; }
        .inv-sign-label { position: absolute; top: 8px; right: 14px; font-size: 13px; font-weight: 900; color: #14449a; }

        /* Footer */
        .inv-footer { margin-top: auto; padding-top: 6px; flex-shrink: 0; break-inside: avoid; page-break-inside: avoid; }
        .inv-footer-wave { display: block; width: 100%; height: 34px; margin-bottom: -1px; }
        .inv-footer-body { background: #0b2a6b; color: #fff; padding: 6px 26px 12px; }
        .inv-footer-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .inv-footer-brand { display: flex; align-items: center; gap: 8px; }
        .inv-footer-logo { background: #fff; border-radius: 10px; padding: 2px; display: flex; }
        .inv-footer-yas { font-size: 24px; font-weight: 900; letter-spacing: 1.5px; line-height: 1; }
        .inv-footer-sub { font-size: 10px; margin-top: 3px; }
        .inv-footer-phone { display: flex; align-items: center; gap: 10px; padding-right: 14px; border-right: 1px solid rgba(255,255,255,.35); }
        .inv-footer-circle { width: 42px; height: 42px; border: 2px solid #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
        .inv-footer-small { font-size: 10px; }
        .inv-footer-phone b { font-size: 15px; letter-spacing: .5px; }
        .inv-footer-addr { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; }
        .inv-footer-slogan { font-size: 13px; font-style: italic; font-weight: 800; text-align: center; line-height: 1.4; }
        .inv-footer-rights { text-align: center; font-size: 10.5px; margin-top: 8px; font-weight: 700; }

        @media screen { #printable-invoice { display: none; } }
      `}</style>

      {/* Hidden Printable Invoices (purchase + sales) */}
      {printMeta && invoices.length > 0 && (
        <div id="printable-invoice" className="font-sans">
          {invoices.map((inv, i) => (
            <InvoicePage key={`${inv.kind}-${inv.number}-${i}`} inv={inv} meta={printMeta} />
          ))}
        </div>
      )}

      {/* ===== رأس الصفحة ===== */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800">الطلبات</h2>
          <p className="text-sm text-slate-500 mt-1">تابع طلبات العملاء، غيّر حالتها واطبع الفواتير</p>
        </div>
        <button
          type="button"
          onClick={() => setShowPrintSettings(s => !s)}
          aria-expanded={showPrintSettings}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-teal-700 shadow-sm hover:bg-teal-50 transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          إعدادات الطباعة
          <ChevronDown className={`w-4 h-4 transition-transform ${showPrintSettings ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>}

      {/* إعدادات الطباعة (تظهر عند الضغط) */}
      {showPrintSettings && (
        <div className="mb-6 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">الاسم الظاهر أعلى الفواتير (شراء وبيع) — محفوظ تلقائياً:</label>
              <input
                type="text"
                value={invoiceName}
                onChange={e => setInvoiceName(e.target.value)}
                placeholder="مثال: الجوهري"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">اسم العميل في فاتورة البيع (اختياري):</label>
              <input
                type="text"
                value={customClientName}
                onChange={e => setCustomClientName(e.target.value)}
                placeholder="سيب فاضي لاستخدام اسم العميل بتاع الطلب"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 bg-slate-50/50"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">المطلوب طباعته:</label>
              <select
                value={printMode}
                onChange={e => setPrintMode(e.target.value as PrintMode)}
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15 bg-slate-50/50"
              >
                <option value="both">فاتورة شراء + فاتورة بيع</option>
                <option value="purchase">فاتورة شراء فقط</option>
                <option value="sales">فاتورة بيع فقط</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ===== بطاقات الإحصائيات ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'العملاء', value: String(groups.length), icon: Users, tone: 'bg-teal-50 text-teal-600' },
          { label: 'الطلبات', value: String(filteredOrders.length), icon: Package, tone: 'bg-sky-50 text-sky-600' },
          { label: 'إجمالي المبالغ', value: `${money(grandTotal)} ج.م`, icon: Wallet, tone: 'bg-emerald-50 text-emerald-600' },
          { label: 'قيد الانتظار', value: String(statusCounts.pending || 0), icon: Clock, tone: 'bg-amber-50 text-amber-600' },
        ].map(s => {
          const StatIcon = s.icon;
          return (
            <div key={s.label} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-200/80 shadow-sm px-4 py-3.5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${s.tone}`}>
                <StatIcon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className="text-lg font-extrabold text-slate-800 truncate tabular-nums">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== الفلاتر والبحث ===== */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="flex gap-1 p-1.5 bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-x-auto">
          {([
            { key: 'all', label: 'الكل', count: orders.length },
            { key: 'pending', label: 'قيد الانتظار', count: statusCounts.pending || 0 },
            { key: 'processing', label: 'قيد المعالجة', count: statusCounts.processing || 0 },
            { key: 'completed', label: 'مكتمل', count: statusCounts.completed || 0 },
            { key: 'cancelled', label: 'ملغي', count: statusCounts.cancelled || 0 },
          ] as { key: StatusFilter; label: string; count: number }[]).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all whitespace-nowrap ${statusFilter === f.key ? 'bg-teal-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {f.label}
              <span className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${statusFilter === f.key ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="بحث بالعميل، المنتج، المورد..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-full min-h-[46px] pr-11 pl-4 text-sm rounded-2xl border border-slate-200/80 bg-white shadow-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/15"
          />
        </div>
      </div>

      {/* شريط الأدوات: تغيير حالة الكل + طي/فتح */}
      {!loading && groups.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 text-sm text-slate-500">
          <span className="font-medium">{groups.length} عميل · {filteredOrders.length} طلب</span>
          <div className="flex items-center gap-3">
            <select
              value=""
              disabled={busy}
              onChange={e => e.target.value && bulkStatus(filteredOrders, e.target.value, 'كل الطلبات المعروضة')}
              className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 cursor-pointer focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              <option value="">تغيير حالة كل الطلبات المعروضة…</option>
              {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
            </select>
            {groups.length > 1 && (
              <button onClick={toggleAllGroups} className="text-teal-700 font-bold hover:underline">
                {allCollapsed ? 'فتح الكل' : 'طي الكل'}
              </button>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-teal-600 animate-spin" /></div>
      ) : groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 text-center py-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-50 mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-300" />
          </div>
          <p className="font-bold text-slate-700">لا توجد طلبات</p>
          <p className="text-sm text-slate-400 mt-1">جرّب تغيير الفلتر أو البحث</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => {
            const isCollapsed = collapsed.has(group.client);
            const singleSupplier = group.suppliers.length === 1;
            const selectedInGroup = group.orders.filter(o => selected.has(o.id)).length;
            const allSelected = selectedInGroup === group.orders.length;
            const someSelected = selectedInGroup > 0 && !allSelected;
            const groupStatuses = Array.from(new Set(group.orders.map(o => o.status)));
            const baseName = clientBase(group.client);
            const typeLabel = clientType(group.client);
            const accent = groupStatuses.length === 1 ? statusAccent[groupStatuses[0]] || 'border-r-slate-300' : 'border-r-slate-300';

            return (
              <div
                key={group.client}
                className={`bg-white rounded-2xl border border-slate-200/80 border-r-4 ${accent} shadow-sm hover:shadow-md transition-shadow overflow-hidden`}
              >
                {/* رأس كارت العميل */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={() => toggleGroupSelection(group)}
                    className="w-4 h-4 accent-teal-600 cursor-pointer"
                    aria-label={`تحديد كل طلبات ${baseName}`}
                  />

                  <button
                    onClick={() => toggleGroup(group.client)}
                    className="flex items-center gap-3.5 flex-1 min-w-[220px] text-right focus:outline-none"
                    aria-expanded={!isCollapsed}
                  >
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-lg font-extrabold flex items-center justify-center shrink-0 shadow-sm">
                      {baseName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-extrabold text-slate-800 truncate">{baseName}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {typeLabel && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            <Building2 className="w-3 h-3" />
                            {typeLabel}
                          </span>
                        )}
                        {singleSupplier && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">
                            <Truck className="w-3 h-3" />
                            {group.suppliers[0]}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 mr-auto transition-transform ${isCollapsed ? 'rotate-90' : ''}`} />
                  </button>

                  <div className="text-left shrink-0 min-w-[110px]">
                    <div className="text-lg font-extrabold text-teal-700 tabular-nums">{money(group.total)} <span className="text-xs font-bold">ج.م</span></div>
                    <div className="text-xs text-slate-500 mt-0.5">{group.orders.length} صنف</div>
                  </div>

                  {/* حالة كل طلبات العميل */}
                  <select
                    value={groupStatuses.length === 1 ? groupStatuses[0] : ''}
                    disabled={busy}
                    onChange={e => e.target.value && bulkStatus(group.orders, e.target.value, baseName)}
                    title="تغيير حالة كل طلبات العميل"
                    className={`text-xs font-bold px-3.5 py-2 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-50 ${groupStatuses.length === 1 ? statusSelectStyles[groupStatuses[0]] : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                  >
                    {groupStatuses.length > 1 && <option value="">حالات مختلفة — طبّق على الكل…</option>}
                    {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}{groupStatuses.length === 1 ? ' (الكل)' : ''}</option>)}
                  </select>

                  <button
                    onClick={() => handlePrint(group.orders)}
                    className="p-2.5 rounded-xl border border-slate-200 text-teal-600 hover:bg-teal-50 transition-colors"
                    title="طباعة فاتورة شراء + فاتورة بيع لكل الأصناف"
                    aria-label="طباعة كل أصناف العميل"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>

                {/* جدول الأصناف */}
                {!isCollapsed && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50/80 text-slate-500">
                        <tr>
                          <th className="w-10 pr-5 py-3" />
                          <th className="text-right px-3 py-3 font-bold text-xs whitespace-nowrap">المنتج</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">الكمية</th>
                          {!singleSupplier && (
                            <th className="text-right px-3 py-3 font-bold text-xs whitespace-nowrap">المورد</th>
                          )}
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">السعر</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">الخصم</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">السعر بعد الخصم</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">الإجمالي</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">التاريخ</th>
                          <th className="text-center px-3 py-3 font-bold text-xs whitespace-nowrap">الحالة</th>
                          <th className="w-12 px-3 py-3" aria-label="إجراءات" />
                        </tr>
                      </thead>
                      <tbody>
                        {group.orders.map(order => {
                          const isSel = selected.has(order.id);
                          return (
                            <tr key={order.id} className={`border-t border-slate-100 transition-colors ${isSel ? 'bg-teal-50/70' : 'hover:bg-slate-50/70'}`}>
                              <td className="pr-5 py-3.5">
                                <input
                                  type="checkbox"
                                  checked={isSel}
                                  onChange={() => toggleOne(order.id)}
                                  className="w-4 h-4 accent-teal-600 cursor-pointer"
                                  aria-label="تحديد الطلب"
                                />
                              </td>
                              <td className="px-3 py-3.5 text-slate-800 font-bold min-w-[200px]">{order.product_name}</td>
                              <td className="px-3 py-3.5 text-center">
                                <span className="inline-block min-w-[32px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold tabular-nums">{order.quantity}</span>
                              </td>
                              {!singleSupplier && (
                                <td className="px-3 py-3.5 text-slate-600 whitespace-nowrap">{order.supplier_real_name}</td>
                              )}
                              <td className="px-3 py-3.5 text-center text-slate-600 tabular-nums">{order.price}</td>
                              <td className="px-3 py-3.5 text-center">
                                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold tabular-nums">{order.discount}%</span>
                              </td>
                              <td className="px-3 py-3.5 text-center text-slate-700 font-semibold tabular-nums">{money(order.final_price)}</td>
                              <td className="px-3 py-3.5 text-center text-teal-700 font-extrabold tabular-nums">{money(lineTotal(order))}</td>
                              <td className="px-3 py-3.5 text-center text-slate-500 text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString('ar-EG')}</td>
                              <td className="px-3 py-3.5 text-center">
                                <select
                                  value={order.status}
                                  onChange={e => handleStatusChange(order.id, e.target.value)}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${statusSelectStyles[order.status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}
                                >
                                  {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                                </select>
                              </td>
                              <td className="px-3 py-3.5">
                                <button
                                  onClick={e => openMenu(e, order)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  aria-label="المزيد من الإجراءات"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* إجمالي الكارت */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-t border-slate-100 text-sm">
                      <span className="text-slate-500 font-semibold">إجمالي طلبات {baseName}</span>
                      <span className="font-extrabold text-teal-700 tabular-nums">{money(group.total)} ج.م</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Floating bulk-action bar for selected rows */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl bg-slate-900 text-white rounded-2xl shadow-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold">تم تحديد {selected.size} طلب</span>
          <select
            value=""
            disabled={busy}
            onChange={e => e.target.value && bulkStatus(selectedOrders, e.target.value, 'المحدد')}
            className="text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white cursor-pointer focus:outline-none disabled:opacity-50"
          >
            <option value="">تغيير الحالة…</option>
            {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
          </select>
          <button
            onClick={() => handlePrint(selectedOrders)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500"
          >
            <Printer className="w-3.5 h-3.5" /> طباعة المحدد
          </button>
          <button
            onClick={() => bulkDelete(Array.from(selected))}
            disabled={busy}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> حذف المحدد
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="mr-auto p-1.5 rounded-lg hover:bg-slate-800"
            aria-label="إلغاء التحديد"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Row actions menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-44 bg-white rounded-xl border border-slate-200 shadow-lg py-1"
            style={{ top: menu.top, left: menu.left }}
          >
            <button
              onClick={() => { const o = menu.order; setMenu(null); handlePrint([o]); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <Printer className="w-4 h-4 text-teal-600" />
              طباعة الفواتير
            </button>
            <button
              onClick={() => { const o = menu.order; setMenu(null); handleDelete(o.id); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              حذف الطلب
            </button>
          </div>
        </>
      )}
    </div>
  );
}