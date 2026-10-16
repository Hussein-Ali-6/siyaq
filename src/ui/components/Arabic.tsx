import type { ReactNode } from 'react';

export function Arabic({ children, className = '', as: Tag = 'p' }: { children: ReactNode; className?: string; as?: 'p' | 'span' | 'div' }) {
  return (
    <Tag dir="rtl" lang="ar" className={`arabic ${className}`}>
      {children}
    </Tag>
  );
}
