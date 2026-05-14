import { LogOut, User } from 'lucide-react';
import { Button } from './ui/button';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from './ThemeToggleButton';
import { roleNames } from '../utils/roles';

export default function DashboardLayout({ user, onLogout, pageTitle, pageDescription, children }) {
  return (
    <div className="app-page min-h-screen text-gray-800 transition-colors duration-300 ease-in-out dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo Plataforma Formativa" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold tracking-tight text-gray-950 sm:text-xl dark:text-white">Plataforma Formativa RITSI</h1>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <ThemeToggleButton />
            <div className="flex min-w-0 max-w-[15rem] items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <User className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              <span className="truncate text-sm font-medium">{user.name}</span>
            </div>
            <Button onClick={onLogout} variant="ghost" size="sm" className="min-w-10 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-300">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {pageTitle && (
          <div className="mb-6 sm:mb-8">
            <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-gray-950 sm:text-3xl dark:text-white">{pageTitle}</h2>
            {pageDescription && <p className="max-w-3xl text-sm leading-6 text-gray-600 sm:text-base dark:text-gray-400">{pageDescription}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
