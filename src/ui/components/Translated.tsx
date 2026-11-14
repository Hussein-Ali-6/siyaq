import type { ReactNode } from 'react';
import { resolveLanguage } from '@/lib/languages';

/** Text in the reader's language: sets its direction, its lang attribute and its script (for fonts). */
export function Translated({
  language,
  children,
  className = '',
  as: Tag = 'p',
}: {
  language: string;
  children: ReactNode;
  className?: string;
  as?: 'p' | 'span' | 'div';
}) {
  const l = resolveLanguage(language);
  return (
    <Tag dir={l.dir} lang={l.lang} data-script={l.script} className={['translated', className].filter(Boolean).join(' ')}>
      {children}
    </Tag>
  );
}
