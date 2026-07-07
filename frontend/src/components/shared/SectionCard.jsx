/**
 * SectionCard - Consistent card component for sections
 * - Card padding: 16-20px
 * - Card radius: 10-12px
 * - Subtle border and background
 * - Optional title
 */
export default function SectionCard({ children, title, className = '' }) {
  return (
    <div className={`bg-base-200 border border-base-300 rounded-xl p-4 ${className}`}>
      {title && (
        <h3 className="text-base font-semibold text-base-content mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
