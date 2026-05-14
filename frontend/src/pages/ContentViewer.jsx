import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileText, Image as ImageIcon, Presentation, Video, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { api } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ContentViewer({ user }) {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreviewMode = new URLSearchParams(location.search).get('preview') === 'true';
  const [content, setContent] = useState(null);
  const [progress, setProgress] = useState(null);
  const [currentSection, setCurrentSection] = useState('files'); // 'files' or 'quiz'
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);

  useEffect(() => {
    fetchData();
  }, [contentId]);

  useEffect(() => {
    // In preview mode, we don't fetch real progress, we simulate it.
    if (isPreviewMode) setProgress({ files_completed: [], quizzes_completed: {} });
  }, [isPreviewMode]);

  const fetchData = async () => {
    try {
      const [contentRes, progressRes] = await Promise.all([
        api.get(`/content/${contentId}`),
        api.get('/progress')
      ]);
      
      setContent(contentRes.data);
      if (contentRes.data.files.length === 0 && contentRes.data.quizzes.length > 0) {
        setCurrentSection('quiz');
        setCurrentQuizIndex(0);
      }
      const prog = progressRes.data.find(p => p.content_id === contentId);
      setProgress(prog || null);
      
      // Start with first incomplete file or quiz
      if (prog) {
        const incompleteFileIndex = contentRes.data.files.findIndex(
          file => !prog.files_completed?.includes(file.id)
        );
        if (incompleteFileIndex !== -1) {
          setCurrentFileIndex(incompleteFileIndex);
          setCurrentSection('files');
        } else if (contentRes.data.quizzes.length > 0) {
          const incompleteQuizIndex = contentRes.data.quizzes.findIndex(
            quiz => !prog.quizzes_completed?.[quiz.id]?.passed
          );
          if (incompleteQuizIndex !== -1) {
            setCurrentQuizIndex(incompleteQuizIndex);
            setCurrentSection('quiz');
          }
        }
      }
    } catch (error) {
      toast.error('Error al cargar contenido');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkFileCompleted = async () => {
    if (isPreviewMode) {
      toast.info('La finalización de archivos está deshabilitada en el modo de vista previa.');
      return;
    }

    const currentFile = content.files[currentFileIndex];
    
    try {
      await api.post('/progress/file-completed', {
        content_id: contentId,
        file_id: currentFile.id
      });
      
      toast.success('¡Archivo marcado como completado!');
      
      // Refresh progress
      const progressRes = await api.get('/progress');
      const prog = progressRes.data.find(p => p.content_id === contentId);
      setProgress(prog);
      
      // Move to next file or quiz
      if (currentFileIndex < content.files.length - 1) {
        setCurrentFileIndex(currentFileIndex + 1);
      } else if (content.quizzes.length > 0) {
        setCurrentSection('quiz');
        setCurrentQuizIndex(0);
      }
    } catch (error) {
      toast.error('Error al marcar como completado');
    }
  };

  const handleSubmitQuiz = async () => {
    if (isPreviewMode) {
      toast.info('El envío de cuestionarios está deshabilitado en el modo de vista previa.');
      return;
    }

    const currentQuiz = content.quizzes[currentQuizIndex];
    
    // Validate all questions answered
    const allAnswered = currentQuiz.questions.every(q => quizAnswers[q.id]?.length > 0);
    if (!allAnswered) {
      toast.error('Por favor responde todas las preguntas');
      return;
    }
    
    setSubmittingQuiz(true);
    try {
      const response = await api.post('/progress/submit-quiz', {
        content_id: contentId,
        quiz_id: currentQuiz.id,
        answers: quizAnswers
      });
      
      if (response.data.passed) {
        toast.success(`¡Aprobado! Puntuación: ${response.data.score.toFixed(1)}%`);
        
        // Refresh progress
        const progressRes = await api.get('/progress');
        const prog = progressRes.data.find(p => p.content_id === contentId);
        setProgress(prog);
        
        // Check if completed
        if (prog?.completed) {
          toast.success('¡Has completado todo el contenido formativo!', {
            duration: 5000
          });
          setTimeout(() => navigate('/dashboard'), 2000);
        } else {
          // Move to next quiz or finish
          if (currentQuizIndex < content.quizzes.length - 1) {
            setCurrentQuizIndex(currentQuizIndex + 1);
            setQuizAnswers({});
          }
        }
      } else {
        toast.error(
          `No aprobado. Puntuación: ${response.data.score.toFixed(1)}%. Necesitas 70% para aprobar. Intento ${response.data.attempts}.`,
          { duration: 5000 }
        );
        setQuizAnswers({});
      }
    } catch (error) {
      toast.error('Error al enviar cuestionario');
    } finally {
      setSubmittingQuiz(false);
    }
  };

  const isFileCompleted = (fileId) => {
    return progress?.files_completed?.includes(fileId) || false;
  };

  const isQuizPassed = (quizId) => {
    return progress?.quizzes_completed?.[quizId]?.passed || false;
  };

  const canAccessQuizzes = () => {
    if (isPreviewMode) return true;
    if (!content) return false;
    if (content.files.length === 0) return true;
    if (!progress) return false;
    return content.files.every(file => progress.files_completed?.includes(file.id));
  };

  const totalProgressItems = content ? content.files.length + content.quizzes.length : 0;
  const completedProgressItems = totalProgressItems
    ? (progress?.files_completed?.length || 0) + Object.values(progress?.quizzes_completed || {}).filter(q => q.passed).length
    : 0;
  const overallProgress = totalProgressItems ? (completedProgressItems / totalProgressItems) * 100 : 0;

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'image': return <ImageIcon className="w-5 h-5" />;
      case 'presentation': return <Presentation className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const extractDriveFileId = (url = '') => {
    if (url.includes('/file/d/')) {
      return url.split('/file/d/')[1].split('/')[0];
    }

    if (url.includes('id=')) {
      return url.split('id=')[1].split('&')[0];
    }

    return '';
  };

  const extractPresentationId = (url = '') => {
    const match = url.match(/\/presentation\/d\/([^/?#]+)/);
    return match?.[1] || '';
  };

  const renderUnsupportedPreview = (file) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        No se puede previsualizar este recurso desde el visor.
      </p>
      <Button asChild variant="outline">
        <a href={file.google_drive_url} target="_blank" rel="noreferrer">
          Abrir recurso
        </a>
      </Button>
    </div>
  );

  const renderFileEmbed = (file) => {
    const fileId = extractDriveFileId(file.google_drive_url);
    const presentationId = extractPresentationId(file.google_drive_url);

    if (file.file_type === 'video') {
      if (!fileId) return renderUnsupportedPreview(file);

      return (
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            className="w-full h-full"
            title={file.title}
            allow="autoplay"
            allowFullScreen
          />
        </div>
      );
    } else if (file.file_type === 'pdf') {
      if (!fileId) return renderUnsupportedPreview(file);

      return (
        <div className="h-[65svh] min-h-[360px] w-full overflow-hidden rounded-lg bg-gray-100 sm:min-h-[520px] dark:bg-gray-900">
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            className="w-full h-full"
            title={file.title}
          />
        </div>
      );
    } else if (file.file_type === 'image') {
      if (!fileId) return renderUnsupportedPreview(file);

      return (
        <div className="flex w-full items-center justify-center overflow-hidden rounded-lg bg-gray-100 p-3 sm:p-4 dark:bg-gray-900">
          <img
            src={`https://drive.google.com/uc?export=view&id=${fileId}`}
            alt={file.title}
            className="max-w-full h-auto rounded"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    } else if (file.file_type === 'presentation') {
      if (!presentationId) return renderUnsupportedPreview(file);

      return (
        <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden dark:bg-gray-900">
          <iframe
            src={`https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`}
            className="w-full h-full"
            title={file.title}
            allowFullScreen
          />
        </div>
      );
    }

    return renderUnsupportedPreview(file);
  };

  if (loading) {
    return <LoadingSpinner message="Cargando contenido..." />;
  }

  if (!content) {
    return (
      <div className="app-page flex min-h-screen items-center justify-center px-4 text-gray-800 dark:text-gray-200">
        <Card className="max-w-md bg-white/85 text-center dark:bg-gray-900/80">
          <CardContent className="pt-6">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-[#da2724]" />
            <p className="font-semibold">Contenido no encontrado</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/dashboard')}>Volver al dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentFile = content.files[currentFileIndex];
  const currentQuiz = content.quizzes[currentQuizIndex];

  return (
    <div className="app-page min-h-screen text-gray-800 transition-colors duration-300 ease-in-out dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
            <Button
              data-testid="back-button"
              onClick={() => navigate('/dashboard')}
              variant="ghost"
              className="self-start hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al dashboard
            </Button>
            <ThemeToggleButton />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-xl font-extrabold tracking-tight text-gray-950 sm:text-2xl dark:text-white">{content.title}</h1>
              {content.description && (
                <p className="mt-1 max-w-4xl text-sm leading-6 text-gray-600 dark:text-gray-400">{content.description}</p>
              )}
            </div>
            {isPreviewMode && (
              <span className="w-fit rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#b8211e] dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-200">
                Vista previa
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {content.files.length === 0 && content.quizzes.length === 0 && (
              <Card className="bg-white/85 text-center dark:bg-gray-900/70">
                <CardContent className="pt-6">
                  <FileText className="mx-auto mb-3 h-10 w-10 text-gray-400" />
                  <p className="font-medium text-gray-600 dark:text-gray-400">Este contenido todavía no tiene recursos disponibles.</p>
                </CardContent>
              </Card>
            )}

            {currentSection === 'files' && currentFile && (
              <Card className="bg-white/85 dark:bg-gray-900/70">
                <CardHeader>
                  <CardTitle className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {getFileIcon(currentFile.file_type)}
                      <span className="break-words">{currentFile.title}</span>
                    </div>
                    {isFileCompleted(currentFile.id) && (
                      <CheckCircle className="h-6 w-6 shrink-0 text-green-600" />
                    )}
                  </CardTitle>
                  {currentFile.description && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{currentFile.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderFileEmbed(currentFile)}
                  
                  {!isFileCompleted(currentFile.id) && (
                    <Button
                      data-testid="mark-file-completed-button"
                      onClick={handleMarkFileCompleted}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Marcar como Completado
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {currentSection === 'quiz' && currentQuiz && (
              <Card className="bg-white/85 dark:bg-gray-900/70">
                <CardHeader>
                  <CardTitle>{currentQuiz.title}</CardTitle>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Necesitas {currentQuiz.passing_percentage}% para aprobar
                  </p>
                  {!canAccessQuizzes() && (
                    <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/30 dark:bg-yellow-900/20">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        Debes completar todos los archivos antes de acceder a los cuestionarios
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {canAccessQuizzes() ? (
                    <div className="space-y-6">
                      {currentQuiz.questions.map((question, qIndex) => (
                        <Card key={question.id} className="border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40">
                          <CardContent className="pt-6">
                            <p className="font-medium text-gray-800 dark:text-gray-100 mb-4">
                              {qIndex + 1}. {question.question_text}
                            </p>
                            
                            {question.question_type === 'true_false' && (
                              <RadioGroup
                                value={quizAnswers[question.id]?.[0]?.toString()}
                                onValueChange={(value) => {
                                  setQuizAnswers({
                                    ...quizAnswers,
                                    [question.id]: [parseInt(value)]
                                  });
                                }}
                              >
                                {question.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex min-h-11 items-center space-x-2 rounded p-2 transition-colors hover:bg-white dark:hover:bg-gray-800">
                                    <RadioGroupItem value={optIndex.toString()} id={`${question.id}-${optIndex}`} />
                                    <Label htmlFor={`${question.id}-${optIndex}`} className="cursor-pointer flex-1">
                                      {option}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            )}
                            
                            {question.question_type === 'multiple_choice' && (
                              <RadioGroup
                                value={quizAnswers[question.id]?.[0]?.toString()}
                                onValueChange={(value) => {
                                  setQuizAnswers({
                                    ...quizAnswers,
                                    [question.id]: [parseInt(value)]
                                  });
                                }}
                              >
                                {question.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex min-h-11 items-center space-x-2 rounded p-2 transition-colors hover:bg-white dark:hover:bg-gray-800">
                                    <RadioGroupItem value={optIndex.toString()} id={`${question.id}-${optIndex}`} className="dark:text-white" />
                                    <Label htmlFor={`${question.id}-${optIndex}`} className="cursor-pointer flex-1">
                                      {option}
                                    </Label>
                                  </div>
                                ))}
                              </RadioGroup>
                            )}
                            
                            {question.question_type === 'multiple_response' && (
                              <div className="space-y-2">
                                {question.options.map((option, optIndex) => (
                                  <div key={optIndex} className="flex min-h-11 items-center space-x-2 rounded p-2 transition-colors hover:bg-white dark:hover:bg-gray-800">
                                    <Checkbox
                                      id={`${question.id}-${optIndex}`}
                                      checked={quizAnswers[question.id]?.includes(optIndex)}
                                      onCheckedChange={(checked) => {
                                        const current = quizAnswers[question.id] || [];
                                        if (checked) {
                                          setQuizAnswers({
                                            ...quizAnswers,
                                            [question.id]: [...current, optIndex]
                                          });
                                        } else {
                                          setQuizAnswers({
                                            ...quizAnswers,
                                            [question.id]: current.filter(i => i !== optIndex)
                                          });
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`${question.id}-${optIndex}`} className="cursor-pointer flex-1">
                                      {option}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                      
                      <Button
                        data-testid="submit-quiz-button"
                        onClick={handleSubmitQuiz}
                        disabled={submittingQuiz}
                        className="w-full bg-[#da2724] py-6 text-base text-white hover:bg-[#b8211e]"
                      >
                        {submittingQuiz ? 'Enviando...' : 'Enviar Cuestionario'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                      Completa todos los archivos para acceder al cuestionario
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="order-first lg:order-none lg:col-span-1">
            <Card className="bg-white/85 dark:bg-gray-900/70 lg:sticky lg:top-24">
              <CardHeader>
                <CardTitle className="text-lg">Progreso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Files Progress */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Archivos</h3>
                  <div className="space-y-2">
                    {content.files.map((file, index) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setCurrentSection('files');
                          setCurrentFileIndex(index);
                        }}
                        className={`touch-row w-full rounded-lg p-3 text-left transition-all ${
                          currentSection === 'files' && currentFileIndex === index
                            ? 'bg-red-100 dark:bg-red-500/20 border-2 border-red-400 dark:border-red-500'
                            : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {getFileIcon(file.file_type)}
                            <span className="text-sm font-medium truncate">{file.title}</span>
                          </div>
                          {isFileCompleted(file.id) && (
                            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quizzes Progress */}
                {content.quizzes.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">Cuestionarios</h3>
                    <div className="space-y-2">
                      {content.quizzes.map((quiz, index) => (
                        <button
                          key={quiz.id}
                          onClick={() => {
                            if (canAccessQuizzes()) {
                              setCurrentSection('quiz');
                              setCurrentQuizIndex(index);
                            }
                          }}
                          disabled={!canAccessQuizzes()}
                          className={`touch-row w-full rounded-lg p-3 text-left transition-all ${
                            currentSection === 'quiz' && currentQuizIndex === index
                              ? 'bg-red-100 dark:bg-red-500/20 border-2 border-red-400 dark:border-red-500'
                              : canAccessQuizzes()
                              ? 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                              : 'bg-gray-100 dark:bg-gray-800 opacity-50 cursor-not-allowed border-2 border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium truncate">{quiz.title}</span>
                            {isQuizPassed(quiz.id) && (
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overall Progress */}
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Total</span>
                    <span className="font-semibold">
                      {completedProgressItems}
                      {' / '}
                      {totalProgressItems}
                    </span>
                  </div>
                  <Progress
                    value={overallProgress}
                    className="h-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
