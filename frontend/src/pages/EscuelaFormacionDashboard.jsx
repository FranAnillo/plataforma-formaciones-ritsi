import { useState, useEffect } from 'react';
import logo from '../static/1710_Isotipo_Degradado.png'; // Importar la imagen
import { BookOpen, LogOut, User, Plus, FileText, Video, Image as ImageIcon, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import axios from 'axios';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const roleNames = {
  admin: 'Administrador',
  escuela_formacion: 'Escuela de Formación',
  junta_directiva: 'Junta Directiva',
  universidad: 'Universidad',
  representante: 'Representante',
};

export default function EscuelaFormacionDashboard({ user, onLogout, showHeader = true }) {
  console.log(user.user_type);
  const [contents, setContents] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  // Create content form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  
  // Assign content states
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [assignToAll, setAssignToAll] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [contentsRes, repsRes] = await Promise.all([
        axios.get(`${API}/content`),
        axios.get(`${API}/representatives`)
      ]);
      setContents(contentsRes.data || []);
      setRepresentatives(repsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const addFile = () => {
    setFiles([...files, { file_type: 'video', google_drive_url: '', title: '', description: '' }]);
  };

  const updateFile = (index, field, value) => {
    const updatedFiles = [...files];
    updatedFiles[index][field] = value;
    setFiles(updatedFiles);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const addQuiz = () => {
    setQuizzes([...quizzes, { title: '', passing_percentage: 70, questions: [] }]);
  };

  const addQuestion = (quizIndex) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[quizIndex].questions.push({
      question_text: '',
      question_type: 'true_false',
      options: ['Verdadero', 'Falso'],
      correct_answers: []
    });
    setQuizzes(updatedQuizzes);
  };

  const updateQuiz = (quizIndex, field, value) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[quizIndex][field] = value;
    setQuizzes(updatedQuizzes);
  };

  const updateQuestion = (quizIndex, questionIndex, field, value) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[quizIndex].questions[questionIndex][field] = value;
    
    // Update options based on question type
    if (field === 'question_type') {
      if (value === 'true_false') {
        updatedQuizzes[quizIndex].questions[questionIndex].options = ['Verdadero', 'Falso'];
        updatedQuizzes[quizIndex].questions[questionIndex].correct_answers = [];
      } else if (value === 'multiple_choice' || value === 'multiple_response') {
        updatedQuizzes[quizIndex].questions[questionIndex].options = ['', '', '', ''];
        updatedQuizzes[quizIndex].questions[questionIndex].correct_answers = [];
      }
    }
    
    setQuizzes(updatedQuizzes);
  };

  const updateOption = (quizIndex, questionIndex, optionIndex, value) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[quizIndex].questions[questionIndex].options[optionIndex] = value;
    setQuizzes(updatedQuizzes);
  };

  const toggleCorrectAnswer = (quizIndex, questionIndex, optionIndex) => {
    const updatedQuizzes = [...quizzes];
    const question = updatedQuizzes[quizIndex].questions[questionIndex];
    const correctAnswers = question.correct_answers || [];
    
    if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
      // Only one correct answer
      updatedQuizzes[quizIndex].questions[questionIndex].correct_answers = [optionIndex];
    } else {
      // Multiple correct answers
      if (correctAnswers.includes(optionIndex)) {
        updatedQuizzes[quizIndex].questions[questionIndex].correct_answers = 
          correctAnswers.filter(i => i !== optionIndex);
      } else {
        updatedQuizzes[quizIndex].questions[questionIndex].correct_answers = 
          [...correctAnswers, optionIndex];
      }
    }
    
    setQuizzes(updatedQuizzes);
  };

  const removeQuiz = (quizIndex) => {
    setQuizzes(quizzes.filter((_, i) => i !== quizIndex));
  };

  const removeQuestion = (quizIndex, questionIndex) => {
    const updatedQuizzes = [...quizzes];
    updatedQuizzes[quizIndex].questions = updatedQuizzes[quizIndex].questions.filter((_, i) => i !== questionIndex);
    setQuizzes(updatedQuizzes);
  };

  const handleCreateContent = async () => {
    if (!title) {
      toast.error('El título es obligatorio');
      return;
    }

    if (files.length === 0) {
      toast.error('Agrega al menos un archivo');
      return;
    }

    // Validate files
    for (const file of files) {
      if (!file.title || !file.google_drive_url) {
        toast.error('Completa todos los campos de los archivos');
        return;
      }
    }

    // Validate quizzes
    for (const quiz of quizzes) {
      if (!quiz.title) {
        toast.error('Completa todos los títulos de los cuestionarios');
        return;
      }
      if (quiz.questions.length === 0) {
        toast.error(`El cuestionario "${quiz.title}" debe tener al menos una pregunta`);
        return;
      }
      for (const question of quiz.questions) {
        if (!question.question_text) {
          toast.error('Completa todas las preguntas');
          return;
        }
        if (question.correct_answers.length === 0) {
          toast.error(`La pregunta "${question.question_text}" debe tener al menos una respuesta correcta`);
          return;
        }
      }
    }

    try {
      await axios.post(`${API}/content`, {
        title,
        description,
        files,
        quizzes
      });

      toast.success('Contenido creado exitosamente');
      setCreateDialogOpen(false);
      
      // Reset form
      setTitle('');
      setDescription('');
      setFiles([]);
      setQuizzes([]);
      
      // Refresh data
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear contenido');
    }
  };

  const handleAssignContent = async () => {
    if (!selectedContent) {
      toast.error('Selecciona un contenido');
      return;
    }

    if (!assignToAll && selectedUsers.length === 0) {
      toast.error('Selecciona al menos un usuario o marca "Asignar a todos"');
      return;
    }

    try {
      await axios.post(`${API}/assignments`, {
        content_id: selectedContent,
        user_ids: assignToAll ? undefined : selectedUsers,
        assign_to_all_representatives: assignToAll
      });

      toast.success('Contenido asignado exitosamente');
      setAssignDialogOpen(false);
      setSelectedContent(null);
      setSelectedUsers([]);
      setAssignToAll(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar contenido');
    }
  };

  const handleDeleteContent = async (contentId) => {
    try {
      await axios.delete(`${API}/content/${contentId}`);
      toast.success('Contenido eliminado exitosamente');

      // Refresh data
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar contenido');
    }
  };




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

  const dashboardContent = (
    <>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{showHeader ? 'Panel de Escuela de Formación' : 'Gestión de Contenidos'}</h2>
            <p className="text-gray-600 dark:text-gray-400">Crea y asigna contenidos formativos</p>
          </div>
          <div className="flex gap-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-content-button" className="bg-[#da2724] hover:bg-[#b8211e]">
                  <Plus className="w-4 h-4 mr-2" />
                  Crear Contenido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-950">
                <DialogHeader>
                  <DialogTitle>Crear Nuevo Contenido Formativo</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="content-title">Título *</Label>
                      <Input
                        id="content-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Título del contenido"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content-description">Descripción</Label>
                      <Textarea
                        id="content-description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descripción del contenido"
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Files Section */}
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Archivos (Google Drive)</h3>
                      <Button onClick={addFile} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Archivo
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {files.map((file, index) => (
                        <Card key={index} className="bg-gray-50 dark:bg-gray-900">
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm">Archivo {index + 1}</span>
                              <Button
                                onClick={() => removeFile(index)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50"
                              >
                                Eliminar
                              </Button>
                            </div>
                            <Select value={file.file_type} onValueChange={(value) => updateFile(index, 'file_type', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                                <SelectItem value="image">Imagen</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              value={file.title}
                              onChange={(e) => updateFile(index, 'title', e.target.value)}
                              placeholder="Título del archivo"
                            />
                            <Input
                              value={file.google_drive_url}
                              onChange={(e) => updateFile(index, 'google_drive_url', e.target.value)}
                              placeholder="URL de Google Drive (compartido)"
                            />
                            <Input
                              value={file.description}
                              onChange={(e) => updateFile(index, 'description', e.target.value)}
                              placeholder="Descripción (opcional)"
                            />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {/* Quizzes Section */}
                  <div className="border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Cuestionarios</h3>
                      <Button onClick={addQuiz} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Cuestionario
                      </Button>
                    </div>
                    <div className="space-y-6">
                      {quizzes.map((quiz, quizIndex) => (
                        <Card key={quizIndex} className="bg-blue-50 dark:bg-blue-900/20">
                          <CardContent className="pt-6 space-y-4">
                            <div className="flex justify-between items-center">
                              <span className="font-semibold">Cuestionario {quizIndex + 1}</span>
                              <Button
                                onClick={() => removeQuiz(quizIndex)}
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50"
                              >
                                Eliminar
                              </Button>
                            </div>
                            <Input
                              value={quiz.title}
                              onChange={(e) => updateQuiz(quizIndex, 'title', e.target.value)}
                              placeholder="Título del cuestionario"
                            />
                            <div className="flex items-center gap-2">
                              <Label className="whitespace-nowrap">Porcentaje para aprobar:</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={quiz.passing_percentage}
                                onChange={(e) => updateQuiz(quizIndex, 'passing_percentage', parseFloat(e.target.value))}
                                className="w-24"
                              />
                              <span>%</span>
                            </div>

                            {/* Questions */}
                            <div className="space-y-4 border-t pt-4">
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-sm">Preguntas</span>
                                <Button
                                  onClick={() => addQuestion(quizIndex)}
                                  size="sm"
                                  variant="outline"
                                >
                                  <Plus className="w-3 h-3 mr-1" />
                                  Agregar Pregunta
                                </Button>
                              </div>
                              {quiz.questions.map((question, questionIndex) => (
                                <Card key={questionIndex} className="bg-white dark:bg-gray-800/50">
                                  <CardContent className="pt-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                      <span className="text-sm font-medium">Pregunta {questionIndex + 1}</span>
                                      <Button
                                        onClick={() => removeQuestion(quizIndex, questionIndex)}
                                        size="sm"
                                        variant="ghost"
                                        className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50 h-8 px-2"
                                      >
                                        Eliminar
                                      </Button>
                                    </div>
                                    <Textarea
                                      value={question.question_text}
                                      onChange={(e) => updateQuestion(quizIndex, questionIndex, 'question_text', e.target.value)}
                                      placeholder="Texto de la pregunta"
                                      rows={2}
                                    />
                                    <Select
                                      value={question.question_type}
                                      onValueChange={(value) => updateQuestion(quizIndex, questionIndex, 'question_type', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="true_false">Verdadero/Falso</SelectItem>
                                        <SelectItem value="multiple_choice">Opción Múltiple (una respuesta)</SelectItem>
                                        <SelectItem value="multiple_response">Opción Múltiple (varias respuestas)</SelectItem>
                                      </SelectContent>
                                    </Select>

                                    {/* Options */}
                                    <div className="space-y-2 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                                      <Label className="text-xs text-gray-600">Opciones:</Label>
                                      {question.options.map((option, optionIndex) => (
                                        <div key={optionIndex} className="flex items-center gap-2">
                                          <Checkbox
                                            checked={question.correct_answers?.includes(optionIndex)}
                                            onCheckedChange={() => toggleCorrectAnswer(quizIndex, questionIndex, optionIndex)}
                                          />
                                          {question.question_type === 'true_false' ? (
                                            <Label className="flex-1">{option}</Label>
                                          ) : (
                                            <Input
                                              value={option}
                                              onChange={(e) => updateOption(quizIndex, questionIndex, optionIndex, e.target.value)}
                                              placeholder={`Opción ${optionIndex + 1}`}
                                              className="flex-1"
                                            />
                                          )}
                                        </div>
                                      ))}
                                      <p className="text-xs text-gray-500 mt-2">
                                        Marca las opciones correctas
                                      </p>
                                    </div>
                                  </CardContent>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Button
                    data-testid="submit-content-button"
                    onClick={handleCreateContent}
                    className="w-full bg-[#da2724] hover:bg-[#b8211e] py-6"
                  >
                    Crear Contenido Formativo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="assign-content-button" variant="outline">
                  Asignar Contenido
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
                <DialogHeader>
                  <DialogTitle>Asignar Contenido</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Selecciona Contenido</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-3">
                      {contents.map((content) => (
                        <div key={content.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                          <input
                            type="radio"
                            id={`content-${content.id}`}
                            name="content"
                            checked={selectedContent === content.id}
                            onChange={() => setSelectedContent(content.id)}
                            className="w-4 h-4 text-[#da2724] focus:ring-[#da2724]"
                          />
                          <Label htmlFor={`content-${content.id}`} className="cursor-pointer flex-1">
                            {content.title}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <Checkbox
                      id="assign-all"
                      checked={assignToAll}
                      onCheckedChange={setAssignToAll}
                    />
                    <Label htmlFor="assign-all" className="cursor-pointer font-medium">
                      Asignar a todos los representantes
                    </Label>
                  </div>

                  {!assignToAll && (
                    <div>
                      <Label className="text-base font-semibold mb-3 block">Selecciona Representantes</Label>
                      <div className="space-y-2 max-h-64 overflow-y-auto border dark:border-gray-700 rounded-lg p-3">
                        {representatives.map((rep) => (
                          <div key={rep.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                            <Checkbox
                              id={`rep-${rep.id}`}
                              checked={selectedUsers.includes(rep.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, rep.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== rep.id));
                                }
                              }}
                            />
                            <Label htmlFor={`rep-${rep.id}`} className="cursor-pointer flex-1">
                              <div>
                                <p className="font-medium">{rep.name}</p>
                                <p className="text-sm text-gray-500">{rep.email}</p>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    data-testid="confirm-assign-button"
                    onClick={handleAssignContent}
                    className="w-full bg-[#da2724] hover:bg-[#b8211e]"
                  >
                    Asignar Contenido
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="bg-white dark:bg-gray-800/50">
          <CardHeader>
            <CardTitle>Contenidos Creados ({contents.length})</CardTitle>
          </CardHeader>
 <CardContent>
            {contents.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">No hay contenidos creados aún</p>
 ) : (
 <div className="space-y-4">
 {contents.map((content) => (
 <Card key={content.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
 <CardContent className="pt-6">
 <div className="flex justify-between items-start">
 <div>
 <h3 className="font-bold text-lg mb-2">{content.title}</h3>
 {content.description && (
 <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{content.description}</p>
 )}
 </div>
 <Button onClick={() => handleDeleteContent(content.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
 <Trash2 className="w-4 h-4 mr-2" />
 Eliminar
 </Button>
 </div>
 <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" />
                          {content.files.length} archivos
                        </span>
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-4 h-4" />
                          {content.quizzes.length} cuestionarios
                        </span>
 </div>
 </CardContent>
 </Card>
 ))}
 </div>
 )}
 </CardContent>
      </Card>
    </>
  );

  if (!showHeader) {
    return dashboardContent;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo de Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold">Plataforma Formativa</h1>
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
      <main className="container mx-auto px-6 py-8">
        {dashboardContent}
      </main>
    </div>
  );
}
