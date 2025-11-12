import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, LogOut, User, TrendingUp } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function RepresentativeDashboard({ user, onLogout }) {
  const [contents, setContents] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Plataforma Formativa</h1>
              <p className="text-sm text-gray-600">Representante</p>
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

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            Mi Contenido Formativo
          </h2>
          <p className="text-gray-600">Completa los contenidos y cuestionarios asignados</p>
        </div>

        {contents.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No tienes contenido asignado aún</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contents.map((content) => {
              const prog = getProgressForContent(content.id);
              const progressPercent = calculateProgress(content, prog);
              const isCompleted = prog?.completed || false;

              return (
                <Card
                  key={content.id}
                  data-testid={`content-card-${content.id}`}
                  className="hover:shadow-lg transition-all border-2 hover:border-indigo-200 cursor-pointer"
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
                    {content.description && (
                      <CardDescription className="line-clamp-2">{content.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <BookOpen className="w-4 h-4" />
                        <span>{content.files.length} archivos</span>
                        <span className="mx-2">•</span>
                        <span>{content.quizzes.length} cuestionarios</span>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            Progreso
                          </span>
                          <span className="font-semibold text-indigo-600">{progressPercent}%</span>
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