import { ReactNode } from 'react';

type CardVariant = 'default' | 'elevated' | 'bordered';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  variant?: CardVariant;
  /** Renders a 3px gradient top-border accent in brand colors */
  accent?: boolean;
  /** Adds a hover lift effect */
  hoverable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-gray-200 shadow-sm',
  elevated: 'bg-white border border-gray-100 shadow-md',
  bordered: 'bg-white border-2 border-gray-200 shadow-none',
};

export default function Card({
  children,
  className = '',
  title,
  subtitle,
  action,
  variant = 'default',
  accent = false,
  hoverable = false,
}: CardProps) {
  return (
    <div
      className={[
        'rounded-xl overflow-hidden',
        variantStyles[variant],
        hoverable ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {accent && (
        <div className="h-[3px] w-full bg-gradient-to-r from-brand-500 via-indigo-400 to-purple-500" />
      )}

      {(title || subtitle || action) && (
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100">
          <div className="min-w-0">
            {title && (
              <h3 className="font-semibold text-gray-800 leading-snug truncate">{title}</h3>
            )}
            {subtitle && (
              <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {action && <div className="ml-4 flex-shrink-0">{action}</div>}
        </div>
      )}

      <div className="p-5">{children}</div>
    </div>
  );
}
