import { MessageCircle, Facebook, Instagram, Ghost, Twitter } from 'lucide-react';
import { CONTACT } from '../lib/contact';

type Props = { variant?: 'compact' | 'labeled' };

const ITEMS = [
  { key: 'whatsapp', label: 'واتساب', Icon: MessageCircle, color: '#25D366' },
  { key: 'facebook', label: 'فيسبوك', Icon: Facebook, color: '#1877F2' },
  { key: 'instagram', label: 'انستجرام', Icon: Instagram, color: '#E4405F' },
  { key: 'snapchat', label: 'سناب شات', Icon: Ghost, color: '#FFB800' },
  { key: 'twitter', label: 'تويتر X', Icon: Twitter, color: '#1DA1F2' },
] as const;

export function SocialLinks({ variant = 'compact' }: Props) {
  const items = ITEMS.filter((i) => CONTACT[i.key]);
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2" dir="rtl">
      {items.map(({ key, label, Icon, color }) => (
        <a
          key={key}
          href={CONTACT[key]}
          target="_blank"
          rel="noopener noreferrer"
          title={label}
          aria-label={label}
          className={
            variant === 'labeled'
              ? 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:shadow-md'
              : 'flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 transition hover:scale-110'
          }
        >
          <Icon size={18} style={{ color }} />
          {variant === 'labeled' && <span>{label}</span>}
        </a>
      ))}
    </div>
  );
}