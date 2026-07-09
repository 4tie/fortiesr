/**
 * PageHeader - Consistent page title and action header
 * - Page title: 22-26px
 * - Optional subtitle
 * - Action buttons on the right
 * - Consistent spacing
 */
export default function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className}`}>
      <div className="flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-base-content mb-1">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-base-content/60">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
