import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

export default function RepresentativeCheckboxList({
  representatives = [],
  selectedUserIds = [],
  onSelectedUserIdsChange,
  idPrefix = 'rep',
  showEmail = false,
  emptyMessage = 'No hay representantes disponibles',
}) {
  const toggleUser = (userId, checked) => {
    const nextSelection = checked
      ? [...selectedUserIds, userId]
      : selectedUserIds.filter((id) => id !== userId);

    onSelectedUserIdsChange(nextSelection);
  };

  if (!representatives.length) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3 dark:border-gray-700">
      {representatives.map((representative) => (
        <div key={representative.id} className="flex items-center space-x-2 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800">
          <Checkbox
            id={`${idPrefix}-${representative.id}`}
            checked={selectedUserIds.includes(representative.id)}
            onCheckedChange={(checked) => toggleUser(representative.id, checked)}
          />
          <Label htmlFor={`${idPrefix}-${representative.id}`} className="flex-1 cursor-pointer">
            {showEmail ? (
              <div>
                <p className="font-medium">{representative.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{representative.email}</p>
              </div>
            ) : (
              representative.name
            )}
          </Label>
        </div>
      ))}
    </div>
  );
}
