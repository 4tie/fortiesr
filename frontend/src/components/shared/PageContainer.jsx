/**
 * PageContainer - Consistent page layout wrapper
 * - Max width: 1600px
 * - Centered with auto margins
 * - Responsive padding
 * - Prevents horizontal overflow
 */
export default function PageContainer({ children, className = '' }) {
  return (
    <div className={`w-full max-w-[1600px] mx-auto px-6 py-6 ${className}`}>
      {children}
    </div>
  );
}
