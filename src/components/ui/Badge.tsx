import { type ReactNode } from 'react';

type Status = 'found' | 'similar' | 'not_found' | 'default' | 'success' | 'warning' | 'error';

interface BadgeProps {
  status?: Status;
  children: ReactNode;
  className?: string;
}

const statusClasses: Record<Status, string> = {
  found: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  similar: 'bg-amber-50 text-amber-700 border-amber-200',
  not_found: 'bg-red-50 text-red-700 border-red-200',
  default: 'bg-slate-50 text-slate-600 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
};

const statusLabels: Record<Status, string> = {
  found: 'موجود',
  similar: 'متشابه',
  not_found: 'غير موجود',
  default: '',
  success: '',
  warning: '',
  error: '',
};

export function Badge({ status = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusClasses[status]} ${className}`}>
      {children ?? statusLabels[status]}
    </span>
  );
}
