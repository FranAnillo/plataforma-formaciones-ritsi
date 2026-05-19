export default function ContentSummaryList({ contents = [], emptyMessage = 'No hay contenidos disponibles' }) {
  if (!contents.length) {
    return <p className="py-8 text-center text-gray-600 dark:text-gray-400">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {contents.map((content) => (
        <div
          key={content.id}
          className="rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <h4 className="font-semibold">{content.title}</h4>
          {content.description && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{content.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
            <span>{content.files?.length || 0} archivos</span>
            <span>•</span>
            <span>{content.quizzes?.length || 0} cuestionarios</span>
          </div>
        </div>
      ))}
    </div>
  );
}
