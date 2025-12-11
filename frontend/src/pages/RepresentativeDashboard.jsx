import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, User, TrendingUp, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { roleNames } from '../utils/roles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RepresentativeDashboard({ user, onLogout }) {
  const [contents, setContents] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contentsRes, progressRes] = await Promise.all([
        axios.get(`${API}/content`),
        axios.get(`${API}/progress`)
      ]);
      setContents(contentsRes.data);
      setProgress(progressRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const getProgressForContent = (contentId) => {
    return progress.find(p => p.content_id === contentId);
  };

  const calculateProgress = (content, prog) => {
    if (!prog) return 0;
    
    const totalItems = content.files.length + content.quizzes.length;
    if (totalItems === 0) return 0;
    
    const completedFiles = prog.files_completed?.length || 0;
    const completedQuizzes = Object.values(prog.quizzes_completed || {}).filter(q => q.passed).length;
    
    return Math.round(((completedFiles + completedQuizzes) / totalItems) * 100);
  };

  const filteredContents = contents.filter(content => {
    const matchesPublicFilter = !showOnlyPublic || content.is_public;
    const matchesSearch = content.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPublicFilter && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 transition-colors duration-300 ease-in-out">
        <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#da2724] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      {/* Header */}
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
              className="hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Mi Contenido Formativo</h2>
            <p className="text-gray-600 dark:text-gray-400">Completa los contenidos y cuestionarios asignados</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="show-public" checked={showOnlyPublic} onCheckedChange={setShowOnlyPublic} />
              <Label htmlFor="show-public">Mostrar solo contenido público</Label>
            </div>
          </div>
        </div>

        {filteredContents.length === 0 ? (
          <Card className="text-center py-12 bg-white dark:bg-gray-800/50">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                {searchQuery ? 'No se encontraron formaciones con ese título' : (showOnlyPublic ? 'No hay contenido público disponible' : 'No tienes contenido asignado aún')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredContents.map((content) => {
              const prog = getProgressForContent(content.id);
              const progressPercent = calculateProgress(content, prog);
              const isCompleted = prog?.completed || false;

              return (
                <Card
                  key={content.id}
                  data-testid={`content-card-${content.id}`}
                  className="bg-white dark:bg-gray-800/50 hover:shadow-lg transition-all border-2 border-gray-200 dark:border-gray-800 hover:border-red-300 dark:hover:border-red-500/50 cursor-pointer"
                  onClick={() => navigate(`/content/${content.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between">
                      <span className="text-lg">{content.title}</span>
                      {isCompleted && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-full font-medium">
                          Completado
                        </span>
                      )}
                    </CardTitle>
                    {content.description && <CardDescription className="line-clamp-2">{content.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <BookOpen className="w-4 h-4" />
                        <span>{content.files.length} archivos</span>
                        <span className="mx-2">•</span>
                        <span>{content.quizzes.length} cuestionarios</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Progreso
                          </span>
                          <span className="font-semibold text-[#da2724]">{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}