import { LogOut, User } from 'lucide-react';
import { Button } from './ui/button';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from './ThemeToggleButton';
import { roleNames } from '../utils/roles';

export default function DashboardLayout({ user, onLogout, pageTitle, pageDescription, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">Plataforma Formativa RITSI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <ThemeToggleButton />
            <div className="flex min-w-0 max-w-[14rem] items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 sm:px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="truncate text-sm font-medium">{user.name}</span>
            </div>
            <Button onClick={onLogout} variant="ghost" size="sm" className="hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {pageTitle && (
          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{pageTitle}</h2>
            {pageDescription && <p className="text-gray-600 dark:text-gray-400">{pageDescription}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
