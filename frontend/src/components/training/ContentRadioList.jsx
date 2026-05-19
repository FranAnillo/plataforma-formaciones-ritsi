import { Label } from '../ui/label';

export default function ContentRadioList({
  contents = [],
  selectedContentId,
  onSelectContent,
  name = 'content',
  maxHeightClass = 'max-h-64',
  showDescription = false,
  emptyMessage = 'No hay contenidos disponibles para seleccionar',
}) {
  if (!contents.length) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className={`space-y-2 overflow-y-auto rounded-lg border p-3 dark:border-gray-700 ${maxHeightClass}`}>
      {contents.map((content) => (
        <div key={content.id} className="flex items-center space-x-2 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
          <input
            type="radio"
            id={`${name}-${content.id}`}
            name={name}
            checked={selectedContentId === content.id}
            onChange={() => onSelectContent(content.id)}
            className="h-4 w-4 text-[#da2724] focus:ring-[#da2724]"
          />
          <Label htmlFor={`${name}-${content.id}`} className="flex-1 cursor-pointer">
            {showDescription ? (
              <div>
                <p className="font-medium">{content.title}</p>
                {content.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{content.description}</p>
                )}
              </div>
            ) : (
              content.title
            )}
          </Label>
        </div>
      ))}
    </div>
  );
}
