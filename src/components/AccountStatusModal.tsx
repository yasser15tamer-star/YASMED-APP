import { useEffect, useState } from 'react';
import { X, Lock, Clock, Phone, Copy, Check, ShieldCheck, Code2, MessageCircle } from 'lucide-react';

type Props = {
  open: boolean;
  type: 'suspended' | 'pending';
  onClose: () => void;
  supportName: string;
  supportPhone: string;
  designer: string;
  designerPhone: string;
  brandEn?: string;
  brandAr?: string;
};

// 01025038752 -> 201025038752 (صيغة واتساب لمصر)
const toWa = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.startsWith('0') ? '2' + d : d;
};

const CONTENT = {
  suspended: {
    chip: 'الحساب موقوف مؤقتاً',
    title: 'حسابك غير مفعل حالياً',
    sub: 'تم إيقاف أو تعطيل هذا الحساب مؤقتاً من قبل الإدارة.',
    steps: ['تم إيقاف الحساب', 'تواصل مع المسؤول', 'إعادة التفعيل'],
  },
  pending: {
    chip: 'الطلب قيد المراجعة',
    title: 'تم تقديم طلبك بنجاح!',
    sub: 'حسابك الآن قيد المراجعة من قبل الإدارة ولن تتمكن من الدخول حتى يتم الاعتماد.',
    steps: ['تم تقديم الطلب', 'مراجعة الإدارة', 'تفعيل الحساب'],
  },
} as const;

export function AccountStatusModal({
  open, type, onClose, supportName, supportPhone, designer, designerPhone,
  brandEn = 'YASMED', brandAr = 'نظام إدارة الصيدليات والمخازن',
}: Props) {
  const [copied, setCopied] = useState(false);
  const c = CONTENT[type];
  const pending = type === 'pending';

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(supportPhone); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="am-overlay" role="dialog" aria-modal="true" aria-labelledby="am-title" onClick={onClose}>
      <span className="am-blob am-a" /><span className="am-blob am-b" /><span className="am-blob am-c" />

      <div className="am-frame" onClick={(e) => e.stopPropagation()}>
        <div className="am-modal" dir="rtl">

          <div className="am-top">
            <div className="am-brand">
              <span className="am-logo">Y</span>
              <span>{brandEn}<small>{brandAr}</small></span>
            </div>
            <button className="am-x" onClick={onClose} aria-label="إغلاق"><X size={16} /></button>
          </div>

          <div className="am-radar">
            <i /><i /><i />
            <div className={`am-core ${pending ? 'am-core-amber' : ''}`}>
              {pending ? <Clock size={38} /> : <Lock size={38} />}
            </div>
          </div>

          <span className={`am-chip ${pending ? 'am-chip-amber' : ''}`}><i />{c.chip}</span>
          <h1 id="am-title" className="am-title">{c.title}</h1>
          <p className="am-sub">{c.sub}</p>

          <div className="am-track">
            <div className="am-n am-d"><b><Check size={15} /></b>{c.steps[0]}</div>
            <div className="am-n am-c2"><b>2</b>{c.steps[1]}</div>
            <div className="am-n"><b>3</b>{c.steps[2]}</div>
          </div>

          <div className="am-contact">
            <p>للاستفسار أو سرعة تفعيل حسابك، يُرجى التواصل مباشرة مع المسؤول:</p>
            <div className="am-person">
              <div className="am-av"><ShieldCheck size={26} /></div>
              <div>
                <div className="am-name">{supportName}</div>
                <div className="am-role">المسؤول</div>
              </div>
            </div>
            <div className="am-numrow">
              <span className="am-num" dir="ltr">{supportPhone}</span>
              <button type="button" className="am-copy" onClick={copy}>
                {copied ? <><Check size={14} /> تم النسخ</> : <><Copy size={14} /> نسخ الرقم</>}
              </button>
            </div>
            <div className="am-acts">
              <a className="am-btn am-call" href={`tel:${supportPhone}`}><Phone size={18} /> اتصال الآن</a>
              <a className="am-btn am-wa" href={`https://wa.me/${toWa(supportPhone)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={18} /> واتساب
              </a>
            </div>
          </div>

          <button type="button" className="am-btn am-primary" onClick={onClose}>فهمت، إغلاق الرسالة</button>

          <div className="am-dev">
            <div className="am-dev-ic"><Code2 size={24} /></div>
            <div className="am-dev-tx">
              <small>✦ تصميم وتطوير الموقع</small>
              <strong>{designer}</strong>
              <a href={`tel:${designerPhone}`} dir="ltr">{designerPhone}</a>
            </div>
            <div className="am-dev-go">
              <a className="am-g1" href={`tel:${designerPhone}`} aria-label="اتصال"><Phone size={20} /></a>
              <a className="am-g2" href={`https://wa.me/${toWa(designerPhone)}`} target="_blank" rel="noopener noreferrer" aria-label="واتساب"><MessageCircle size={20} /></a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}