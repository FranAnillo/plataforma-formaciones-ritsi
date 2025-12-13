/**
 * LoadingSpinner Component
 * Provides a consistent loading indicator across the application
 */
export default function LoadingSpinner({ message = 'Cargando...', size = 'default' }) {
  const sizeClasses = {
    small: 'h-8 w-8 border-2',
    default: 'h-16 w-16 border-b-4',
    large: 'h-24 w-24 border-b-4'
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 transition-colors duration-300 ease-in-out">
      <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
        <div className={`animate-spin rounded-full ${spinnerSize} border-[#da2724] mx-auto mb-4`}></div>
        <p className="text-lg text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}
