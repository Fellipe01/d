type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

interface BadgeProps {
  label: string;
  /** Semantic color variant. When provided, overrides className color styles. */
  variant?: BadgeVariant;
  /** Show a small colored dot before the label */
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-100 text-brand-700',
  success: 'bg-success-100 text-success-700',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-100 text-danger-700',
  info: 'bg-blue-100 text-blue-700',
  neutral: 'bg-gray-100 text-gray-600',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
};

export default function Badge({ label, variant, dot = false, className = '' }: BadgeProps) {
  const colorClass = variant ? variantStyles[variant] : '';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
        colorClass,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dot && variant && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotStyles[variant]}`}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}
