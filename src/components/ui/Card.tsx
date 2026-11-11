import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 ${className}`}>
      {children}
    </div>
  );
}

interface CardBodyProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function CardBody({ children, className = '', onClick }: CardBodyProps) {
  return (
    <div className={`p-6 ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
