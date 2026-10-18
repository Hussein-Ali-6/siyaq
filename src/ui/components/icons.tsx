type IconProps = { className?: string };

export const CloseIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const BackIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3L5 8l5 5" />
  </svg>
);

export const BookIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2H7a1.5 1.5 0 0 1 1 .4A1.5 1.5 0 0 1 9 2h3.5A1.5 1.5 0 0 1 14 3.5V13H9a1 1 0 0 0-1 1 1 1 0 0 0-1-1H2z" />
    <path d="M8 2.4V14" />
  </svg>
);

export const StarIcon = ({ className = 'h-4 w-4', filled = false }: IconProps & { filled?: boolean }) => (
  <svg viewBox="0 0 16 16" className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z" />
  </svg>
);

export const ChevronIcon = ({ className = 'h-3.5 w-3.5', open = false }: IconProps & { open?: boolean }) => (
  <svg viewBox="0 0 16 16" className={`${className} transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

export const TrashIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.6 9h4.8L11 4" />
  </svg>
);

export const ExternalIcon = ({ className = 'h-3.5 w-3.5' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 3h4v4M13 3L7 9M11 9v4H3V5h4" />
  </svg>
);

export const SpeakerIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z" />
    <path d="M10.8 5.6a3.4 3.4 0 0 1 0 4.8M12.6 3.8a6 6 0 0 1 0 8.4" />
  </svg>
);

export const VideoIcon = ({ className = 'h-4 w-4' }: IconProps) => (
  <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
    <rect x="1.8" y="3.5" width="12.4" height="9" rx="2.2" />
    <path d="M6.6 6.1v3.8L9.9 8z" fill="currentColor" />
  </svg>
);
