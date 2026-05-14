export default function LoadingSpinner({ message = "Cargando..." }) {
  return (
    <div className="app-page min-h-screen flex items-center justify-center px-4">
      <div className="text-center" role="status" aria-live="polite" style={{ fontFamily: 'Exo, sans-serif' }}>
        <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-red-100 border-b-[#da2724] dark:border-gray-800 dark:border-b-[#da2724]"></div>
        <p className="text-base font-medium text-gray-700 dark:text-gray-300">{message}</p>
      </div>
    </div>
  );
}
