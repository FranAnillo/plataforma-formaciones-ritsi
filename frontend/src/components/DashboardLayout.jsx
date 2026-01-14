import { LogOut, User } from 'lucide-react';
import { Button } from './ui/button';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from './ThemeToggleButton';
import { roleNames } from '../utils/roles';

export default function DashboardLayout({ user, onLogout, pageTitle, pageDescription, children }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-center sm:text-left">Plataforma Formativa RITSI</h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 text-center sm:text-left">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
            <ThemeToggleButton />
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 sm:px-4 rounded-full">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <Button onClick={onLogout} variant="ghost" size="icon" className="sm:hidden hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="w-5 h-5" />
            </Button>
            <Button onClick={onLogout} variant="ghost" size="sm" className="hidden sm:flex items-center hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {pageTitle && (
          <div className="mb-6 sm:mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{pageTitle}</h2>
            {pageDescription && <p className="text-gray-600 dark:text-gray-400">{pageDescription}</p>}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}