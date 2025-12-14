export default function LoadingSpinner({ message = "Cargando..." }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
      <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#da2724] mx-auto mb-4"></div>
        <p className="text-lg text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}