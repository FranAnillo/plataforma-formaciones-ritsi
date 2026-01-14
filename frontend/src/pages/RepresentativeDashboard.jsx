import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { fetchAllData } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import LoadingSpinner from '../components/LoadingSpinner';

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
      const [contentsRes, progressRes] = await fetchAllData([
        '/content',
        '/progress'
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
    return <LoadingSpinner />;
  }

  return (
    <DashboardLayout user={user} onLogout={onLogout}>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Mi Contenido Formativo</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Completa los contenidos y cuestionarios asignados</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="show-public" checked={showOnlyPublic} onCheckedChange={setShowOnlyPublic} />
              <Label htmlFor="show-public" className="text-sm">Mostrar solo contenido público</Label>
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
    </DashboardLayout>
  );
}