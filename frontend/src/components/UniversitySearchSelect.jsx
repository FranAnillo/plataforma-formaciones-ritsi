import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Input } from './ui/input';

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export default function UniversitySearchSelect({
  universities = [],
  value,
  onChange,
  maxVisible = 8,
}) {
  const selectedUniversity = universities.find((university) => university.id === value);
  const [query, setQuery] = useState('');
  const normalizedQuery = normalize(query);

  const filteredUniversities = normalizedQuery
    ? universities.filter((university) => normalize(university.name).includes(normalizedQuery))
    : universities;

  const visibleUniversities = filteredUniversities.slice(0, maxVisible);
  const hiddenCount = Math.max(0, filteredUniversities.length - visibleUniversities.length);

  return (
    <div className="mt-2 space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          id="university-search"
          data-testid="university-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar universidad por nombre..."
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {selectedUniversity && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          Seleccionada: <span className="font-semibold">{selectedUniversity.name}</span>
        </div>
      )}

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-950/40">
        {visibleUniversities.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
            No hay universidades que coincidan con tu búsqueda.
          </p>
        ) : (
          visibleUniversities.map((university) => {
            const isSelected = university.id === value;
            return (
              <button
                key={university.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onChange(university.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-red-50 font-semibold text-[#b8211e] ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-200 dark:ring-red-500/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <span>{university.name}</span>
                {isSelected && <Check className="h-4 w-4 shrink-0" />}
              </button>
            );
          })
        )}
      </div>

      {hiddenCount > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Mostrando {visibleUniversities.length} de {filteredUniversities.length} universidades. Escribe más texto para afinar la búsqueda.
        </p>
      )}
    </div>
  );
}

