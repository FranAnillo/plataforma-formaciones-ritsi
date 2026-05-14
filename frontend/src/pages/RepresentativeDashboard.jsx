import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Search } from 'lucide-react';
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
    
    return Math.min(100, Math.round(((completedFiles + completedQuizzes) / totalItems) * 100));
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
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      pageTitle="Mi contenido formativo"
      pageDescription="Completa las formaciones asignadas y retoma el progreso donde lo dejaste."
    >
        <div className="mb-6 rounded-lg border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900/70">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <Input
                placeholder="Buscar por título..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-800 dark:bg-gray-950/50">
              <Checkbox id="show-public" checked={showOnlyPublic} onCheckedChange={setShowOnlyPublic} />
              <Label htmlFor="show-public" className="cursor-pointer text-sm font-medium leading-5">Mostrar solo contenido público</Label>
            </div>
          </div>
        </div>

        {filteredContents.length === 0 ? (
          <Card className="bg-white/80 py-12 text-center dark:bg-gray-900/70">
            <CardContent>
              <BookOpen className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-base font-medium text-gray-600 dark:text-gray-400">
                {searchQuery ? 'No se encontraron formaciones con ese título' : (showOnlyPublic ? 'No hay contenido público disponible' : 'No tienes contenido asignado aún')}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredContents.map((content) => {
              const prog = getProgressForContent(content.id);
              const progressPercent = calculateProgress(content, prog);
              const isCompleted = prog?.completed || false;

              return (
                <Card
                  key={content.id}
                  data-testid={`content-card-${content.id}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/content/${content.id}`);
                    }
                  }}
                  className="cursor-pointer border-gray-200 bg-white/85 transition-all hover:-translate-y-0.5 hover:border-red-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#da2724] dark:border-gray-800 dark:bg-gray-900/70 dark:hover:border-red-500/50"
                  onClick={() => navigate(`/content/${content.id}`)}
                >
                  <CardHeader>
                    <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <span className="text-lg leading-6 break-words">{content.title}</span>
                      {isCompleted && (
                        <span className="shrink-0 rounded-full bg-green-100 px-2 py-1 text-xs font-bold text-green-700 dark:bg-green-900/40 dark:text-green-200">
                          Completado
                        </span>
                      )}
                    </CardTitle>
                    {content.description && <CardDescription className="line-clamp-2">{content.description}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <BookOpen className="w-4 h-4" />
                        <span>{content.files.length} archivos</span>
                        <span className="text-gray-300 dark:text-gray-700">•</span>
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
