import { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, Users, Building2, GraduationCap, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import EscuelaFormacionDashboard from './EscuelaFormacionDashboard';
import axios from 'axios';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png'; // Importar la imagen

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const roleNames = {
  admin: 'Administrador',
  escuela_formacion: 'Escuela de Formación',
  junta_directiva: 'Junta Directiva',
  universidad: 'Universidad',
  representante: 'Representante',
};

export default function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRepresentatives: 0,
    totalUniversities: 0,
    totalContents: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [repsRes, unisRes, contentsRes] = await Promise.all([
        axios.get(`${API}/representatives`),
        axios.get(`${API}/universities`),
        axios.get(`${API}/content`)
      ]);
      
      setStats({
        totalRepresentatives: repsRes.data.length,
        totalUniversities: unisRes.data.length,
        totalContents: contentsRes.data.length
      });
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#da2724] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo de Gestión de Formaciones RITSI" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold">Gestión de Formaciones RITSI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggleButton />
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <Button
              data-testid="logout-button"
              onClick={onLogout}
              variant="ghost"
              size="sm"
              className="hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Panel de Administración
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Gestión completa de la plataforma</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalRepresentatives}</span>
              </div>
              <p className="text-red-100">Representantes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalUniversities}</span>
              </div>
              <p className="text-red-100">Universidades</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalContents}</span>
              </div>
              <p className="text-red-100">Contenidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <GraduationCap className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">100%</span>
              </div>
              <p className="text-red-100">Sistema Activo</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Content - Reuse Escuela Formacion Dashboard */}
        {/* 
          El componente EscuelaFormacionDashboard ahora se renderiza directamente 
          para el rol 'escuela_formacion'. Para el rol 'admin', su contenido 
          se integra aquí para evitar duplicados.
        */}
        <EscuelaFormacionDashboard user={user} onLogout={onLogout} showHeader={false} />
      </main>
    </div>
  );
}
