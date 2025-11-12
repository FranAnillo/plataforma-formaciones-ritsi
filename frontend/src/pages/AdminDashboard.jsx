import { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, Users, Building2, GraduationCap, FileText } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import EscuelaFormacionDashboard from './EscuelaFormacionDashboard';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Plataforma Formativa</h1>
              <p className="text-sm text-gray-600">Administrador</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">{user.name}</span>
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
          <h2 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Panel de Administración
          </h2>
          <p className="text-gray-600">Gestión completa de la plataforma</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalRepresentatives}</span>
              </div>
              <p className="text-blue-100">Representantes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Building2 className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalUniversities}</span>
              </div>
              <p className="text-purple-100">Universidades</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">{stats.totalContents}</span>
              </div>
              <p className="text-green-100">Contenidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <GraduationCap className="w-8 h-8 opacity-80" />
                <span className="text-3xl font-bold">100%</span>
              </div>
              <p className="text-orange-100">Sistema Activo</p>
            </CardContent>
          </Card>
        </div>

        {/* Admin Content - Reuse Escuela Formacion Dashboard */}
        <Card>
          <CardHeader>
            <CardTitle>Gestión de Contenidos</CardTitle>
          </CardHeader>
          <CardContent>
            <EscuelaFormacionDashboard user={user} onLogout={onLogout} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
