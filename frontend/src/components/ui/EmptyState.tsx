interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      {/* Icon in a gradient ring */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-50 to-indigo-100 border border-brand-100 flex items-center justify-center shadow-sm">
          <span className="text-4xl leading-none select-none" role="img" aria-hidden="true">
            {icon}
          </span>
        </div>
        {/* Decorative ring */}
        <div className="absolute -inset-2 rounded-3xl border border-brand-100/50 pointer-events-none" />
      </div>

      <h3 className="text-xl font-semibold text-gray-800 mb-2 leading-snug">{title}</h3>

      {description && (
        <p className="text-sm text-gray-500 leading-relaxed max-w-xs">{description}</p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
