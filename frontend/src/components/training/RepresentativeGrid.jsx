import { User } from 'lucide-react';
import { Card, CardContent } from '../ui/card';

export default function RepresentativeGrid({ representatives = [], emptyMessage = 'No hay representantes registrados aún' }) {
  if (!representatives.length) {
    return <p className="py-8 text-center text-gray-600 dark:text-gray-400">{emptyMessage}</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {representatives.map((representative) => (
        <Card
          key={representative.id}
          className="border-gray-200 bg-white transition-shadow hover:border-red-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/35"
        >
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              {representative.picture ? (
                <img src={representative.picture} alt={representative.name} className="h-12 w-12 rounded-full" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100">
                  <User className="h-6 w-6 text-[#da2724]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{representative.name}</p>
                <p className="truncate text-sm text-gray-500 dark:text-gray-400">{representative.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
