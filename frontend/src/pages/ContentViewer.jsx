import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileText, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ContentViewer({ user }) {
  const { contentId } = useParams();
  const navigate = useNavigate();
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

  const fetchData = async () => {
    try {
      const [contentRes, progressRes] = await Promise.all([
        axios.get(`${API}/content/${contentId}`),
        axios.get(`${API}/progress`)
      ]);
      
      setContent(contentRes.data);
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
    const currentFile = content.files[currentFileIndex];
    
    try {
      await axios.post(`${API}/progress/file-completed`, {
        content_id: contentId,
        file_id: currentFile.id
      });
      
      toast.success('¡Archivo marcado como completado!');
      
      // Refresh progress
      const progressRes = await axios.get(`${API}/progress`);
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
    const currentQuiz = content.quizzes[currentQuizIndex];
    
    // Validate all questions answered
    const allAnswered = currentQuiz.questions.every(q => quizAnswers[q.id]?.length > 0);
    if (!allAnswered) {
      toast.error('Por favor responde todas las preguntas');
      return;
    }
    
    setSubmittingQuiz(true);
    try {
      const response = await axios.post(`${API}/progress/submit-quiz`, {
        content_id: contentId,
        quiz_id: currentQuiz.id,
        answers: quizAnswers
      });
      
      if (response.data.passed) {
        toast.success(`¡Aprobado! Puntuación: ${response.data.score.toFixed(1)}%`);
        
        // Refresh progress
        const progressRes = await axios.get(`${API}/progress`);
        const prog = progressRes.data.find(p => p.content_id === contentId);
        setProgress(prog);
        
        // Check if completed
        if (prog.completed) {
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
    if (!content || !progress) return false;
    return content.files.every(file => progress.files_completed?.includes(file.id));
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'video': return <Video className="w-5 h-5" />;
      case 'pdf': return <FileText className="w-5 h-5" />;
      case 'image': return <ImageIcon className="w-5 h-5" />;
      default: return <FileText className="w-5 h-5" />;
    }
  };

  const renderFileEmbed = (file) => {
    // Extract file ID from Google Drive URL
    let fileId = '';
    
    if (file.google_drive_url.includes('/file/d/')) {
      fileId = file.google_drive_url.split('/file/d/')[1].split('/')[0];
    } else if (file.google_drive_url.includes('id=')) {
      fileId = file.google_drive_url.split('id=')[1].split('&')[0];
    }

    if (file.file_type === 'video') {
      return (
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            className="w-full h-full"
            allow="autoplay"
            allowFullScreen
          />
        </div>
      );
    } else if (file.file_type === 'pdf') {
      return (
        <div className="w-full h-[600px] bg-gray-100 rounded-lg overflow-hidden">
          <iframe
            src={`https://drive.google.com/file/d/${fileId}/preview`}
            className="w-full h-full"
          />
        </div>
      );
    } else if (file.file_type === 'image') {
      return (
        <div className="w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center p-4">
          <img
            src={`https://drive.google.com/uc?export=view&id=${fileId}`}
            alt={file.title}
            className="max-w-full h-auto rounded"
          />
        </div>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando contenido...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Contenido no encontrado</p>
      </div>
    );
  }

  const currentFile = content.files[currentFileIndex];
  const currentQuiz = content.quizzes[currentQuizIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <Button
            data-testid="back-button"
            onClick={() => navigate('/dashboard')}
            variant="ghost"
            className="mb-2 hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-gray-800">{content.title}</h1>
          {content.description && (
            <p className="text-gray-600 mt-1">{content.description}</p>
          )}
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {currentSection === 'files' && currentFile && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getFileIcon(currentFile.file_type)}
                      {currentFile.title}
                    </div>
                    {isFileCompleted(currentFile.id) && (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    )}
                  </CardTitle>
                  {currentFile.description && (
                    <p className="text-gray-600 text-sm">{currentFile.description}</p>
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
              <Card>
                <CardHeader>
                  <CardTitle>{currentQuiz.title}</CardTitle>
                  <p className="text-sm text-gray-600">
                    Necesitas {currentQuiz.passing_percentage}% para aprobar
                  </p>
                  {!canAccessQuizzes() && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <p className="text-sm text-yellow-800">
                        Debes completar todos los archivos antes de acceder a los cuestionarios
                      </p>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  {canAccessQuizzes() ? (
                    <div className="space-y-6">
                      {currentQuiz.questions.map((question, qIndex) => (
                        <Card key={question.id} className="bg-gray-50">
                          <CardContent className="pt-6">
                            <p className="font-medium text-gray-800 mb-4">
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
                                  <div key={optIndex} className="flex items-center space-x-2 p-2 hover:bg-white rounded transition-colors">
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
                                  <div key={optIndex} className="flex items-center space-x-2 p-2 hover:bg-white rounded transition-colors">
                                    <RadioGroupItem value={optIndex.toString()} id={`${question.id}-${optIndex}`} />
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
                                  <div key={optIndex} className="flex items-center space-x-2 p-2 hover:bg-white rounded transition-colors">
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
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg"
                      >
                        {submittingQuiz ? 'Enviando...' : 'Enviar Cuestionario'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-center text-gray-600 py-8">
                      Completa todos los archivos para acceder al cuestionario
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-lg">Progreso</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Files Progress */}
                <div>
                  <h3 className="font-semibold text-sm text-gray-700 mb-2">Archivos</h3>
                  <div className="space-y-2">
                    {content.files.map((file, index) => (
                      <button
                        key={file.id}
                        onClick={() => {
                          setCurrentSection('files');
                          setCurrentFileIndex(index);
                        }}
                        className={`w-full text-left p-3 rounded-lg transition-all ${
                          currentSection === 'files' && currentFileIndex === index
                            ? 'bg-indigo-100 border-2 border-indigo-400'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
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
                    <h3 className="font-semibold text-sm text-gray-700 mb-2">Cuestionarios</h3>
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
                          className={`w-full text-left p-3 rounded-lg transition-all ${
                            currentSection === 'quiz' && currentQuizIndex === index
                              ? 'bg-indigo-100 border-2 border-indigo-400'
                              : canAccessQuizzes()
                              ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                              : 'bg-gray-100 opacity-50 cursor-not-allowed border-2 border-transparent'
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
                    <span className="text-gray-600">Total</span>
                    <span className="font-semibold">
                      {(progress?.files_completed?.length || 0) + Object.values(progress?.quizzes_completed || {}).filter(q => q.passed).length}
                      {' / '}
                      {content.files.length + content.quizzes.length}
                    </span>
                  </div>
                  <Progress
                    value={(
                      ((progress?.files_completed?.length || 0) + Object.values(progress?.quizzes_completed || {}).filter(q => q.passed).length) /
                      (content.files.length + content.quizzes.length)
                    ) * 100}
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