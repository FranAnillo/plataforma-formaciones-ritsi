import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, HelpCircle, Edit, Tag, GripVertical, Eye, Check, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { roleNames } from '../utils/roles';
import { api, fetchAllData } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import LoadingSpinner from '../components/LoadingSpinner';

export default function EscuelaFormacionDashboard({ user, onLogout, showHeader = true }) {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  
  // Category management states
  const [editCategory, setEditCategory] = useState(null);
  const [deleteCategory, setDeleteCategory] = useState(null);

  // Content filter states
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');

  // Create content form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [quizzes, setQuizzes] = useState([]);
  
  // Assign content states
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [assignCategoryFilter, setAssignCategoryFilter] = useState('all');
  const [assignToAll, setAssignToAll] = useState(false);

  // Drag and drop state
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [draggingItem, setDraggingItem] = useState(null);


  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const endpoints = user.user_type === 'formador'
        ? ['/content', '/categories']
        : ['/content', '/representatives', '/categories'];
      const [contentsRes, repsRes, catsRes] = await fetchAllData(endpoints);

      setContents(contentsRes.data || []);
      setRepresentatives(user.user_type === 'formador' ? [] : (repsRes.data || []));
      setCategories(user.user_type === 'formador' ? (repsRes.data || []) : (catsRes.data || []));
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

  const handleFileSort = () => {
    const newFiles = [...files];
    const draggedItemContent = newFiles.splice(dragItem.current, 1)[0];
    newFiles.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setFiles(newFiles);
    setDraggingItem(null);
  };

  const handleQuizSort = () => {
    const newQuizzes = [...quizzes];
    const draggedItemContent = newQuizzes.splice(dragItem.current, 1)[0];
    newQuizzes.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setQuizzes(newQuizzes);
    setDraggingItem(null);
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
      await api.post('/content', {
        title,
        description,
        is_public: isPublic,
        category_ids: selectedCategories,
        files,
        quizzes
      });

      toast.success('Contenido creado exitosamente');
      setCreateDialogOpen(false);
      
      // Reset form
      setTitle('');
      setDescription('');
      setIsPublic(false);
      setSelectedCategories([]);
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
      await api.post('/assignments', {
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

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('El nombre de la categoría no puede estar vacío');
      return;
    }

    try {
      const response = await api.post('/categories', { name: newCategoryName });
      const newCategory = response.data;
      
      toast.success(`Categoría "${newCategory.name}" creada`);
      
      // Add to state and auto-select
      setCategories([...categories, newCategory]);
      setSelectedCategories([...selectedCategories, newCategory.id]);
      
      // Reset input
      setNewCategoryName('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear la categoría');
    }
  };

  const handleUpdateCategory = async () => {
    if (!editCategory || !editCategory.name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    try {
      const response = await api.put(`/categories/${editCategory.id}`, { name: editCategory.name });
      toast.success('Categoría actualizada');
      setCategories(categories.map(c => c.id === editCategory.id ? response.data : c));
      setEditCategory(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar la categoría');
    }
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategory) return;
    try {
      await api.delete(`/categories/${deleteCategory.id}`);
      toast.success(`Categoría "${deleteCategory.name}" eliminada`);
      setCategories(categories.filter(c => c.id !== deleteCategory.id));
      // Also remove from selected categories if it was selected
      setSelectedCategories(selectedCategories.filter(id => id !== deleteCategory.id));
      setDeleteCategory(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar la categoría');
    }
  };

  const handleApproveContent = async (contentId) => {
    try {
      await api.post(`/content/${contentId}/approve`);
      toast.success('Contenido aprobado y publicado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar el contenido');
    }
  };

  const handleRejectContent = async (contentId) => {
    try {
      await api.post(`/content/${contentId}/reject`);
      toast.success('Contenido rechazado y eliminado');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al rechazar el contenido');
    }
  };

  const handleDeleteContent = async (contentId) => {
    try {
      await api.delete(`/content/${contentId}`);
      toast.success('Contenido eliminado exitosamente');

      // Refresh data
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar contenido');
    }
  };

  const filteredContentsForAssignment = contents.filter(content => {
    if (assignCategoryFilter === 'all') {
      return true;
    }
    return content.category_ids?.includes(assignCategoryFilter);
  });

  const getCategoryNames = (categoryIds) => {
    if (!categoryIds || categoryIds.length === 0) return [];
    return categoryIds.map(id => categories.find(cat => cat.id === id)?.name).filter(Boolean);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Filter contents based on status and visibility
  const filteredContents = contents.filter(content => {
    let statusMatch =
      statusFilter === 'all' ||
      content.status === statusFilter;
    let visibilityMatch =
      visibilityFilter === 'all' ||
      (visibilityFilter === 'public' && content.is_public) ||
      (visibilityFilter === 'private' && !content.is_public);
    return statusMatch && visibilityMatch;
  });

  const dashboardContent = (
    <div className="flex flex-col gap-8"> {/* Cambiado a columna y separado por espacio */}
      {/* Filtros y acciones arriba */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-8">
        {showHeader && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{`Panel de ${roleNames[user.user_type]}`}</h2>
            <p className="text-gray-600 dark:text-gray-400">Crea y asigna contenidos formativos</p>
          </div>
        )}
        <div className={`flex w-full flex-col gap-3 xl:flex-row xl:items-center ${!showHeader ? 'xl:justify-between' : 'xl:w-auto'}`}> {/* Filtros y botones */}
          {user.user_type !== 'formador' && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Label>Estado:</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
              <Label>Visibilidad:</Label>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="public">Público</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row xl:ml-auto">
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
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="is-public"
                        checked={isPublic}
                        onCheckedChange={setIsPublic}
                      />
                      <Label htmlFor="is-public" className="cursor-pointer">Marcar como contenido público (visible para todos)</Label>
                    </div>
                    <div>
                      <Label>Categorías</Label>
                      <div className="flex flex-wrap gap-2 border rounded-md p-2 mt-2">
                        {categories.length > 0 ? categories.map(category => (
                          <div
                            key={category.id}
                            className={`flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors ${
                              selectedCategories.includes(category.id)
                                ? 'bg-red-100 dark:bg-red-900/50'
                                : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                            onClick={() => {
                              const newSelection = selectedCategories.includes(category.id)
                                ? selectedCategories.filter(id => id !== category.id)
                                : [...selectedCategories, category.id];
                              setSelectedCategories(newSelection);
                            }}
                          >
                            <Checkbox checked={selectedCategories.includes(category.id)} />
                            <Label className="cursor-pointer">{category.name}</Label>
                          </div>
                        )) : <p className="text-sm text-gray-500">No hay categorías creadas.</p>}
                      </div>
                      {user.user_type !== 'formador' && (
                        <div className="flex flex-col gap-2 mt-3 sm:flex-row sm:items-center">
                          <Input
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Nombre de la nueva categoría"
                          />
                          <Button type="button" variant="outline" onClick={handleCreateCategory}>
                            Crear
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Files Section */}
                  <div className="border-t pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                      <h3 className="text-lg font-semibold">Archivos (Google Drive)</h3>
                      <Button onClick={addFile} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Archivo
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {files.map((file, index) => (
                        <Card 
                          key={index} 
                          draggable
                          onDragStart={() => { dragItem.current = index; setDraggingItem({type: 'file', index}); }}
                          onDragEnter={() => (dragOverItem.current = index)}
                          onDragEnd={handleFileSort}
                          onDragOver={(e) => e.preventDefault()}
                          className={`bg-gray-50 dark:bg-gray-900 cursor-grab transition-all 
                            ${draggingItem?.type === 'file' && draggingItem?.index === index ? 'opacity-50 shadow-2xl' : 'opacity-100'}
                            ${dragOverItem.current === index ? 'border-2 border-red-400' : ''}`}
                        >
                          <CardContent className="pt-6 space-y-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-5 h-5 text-gray-400" />
                                <span className="font-medium text-sm">Archivo {index + 1}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <Button
                                  onClick={() => removeFile(index)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                            <Select value={file.file_type} onValueChange={(value) => updateFile(index, 'file_type', value)}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="video">Video</SelectItem>
                                <SelectItem value="pdf">PDF</SelectItem>
                                <SelectItem value="image">Imagen</SelectItem>
                                <SelectItem value="presentation">Presentación</SelectItem>
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
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                      <h3 className="text-lg font-semibold">Cuestionarios</h3>
                      <Button onClick={addQuiz} size="sm" variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Agregar Cuestionario
                      </Button>
                    </div>
                    <div className="space-y-6">
                      {quizzes.map((quiz, quizIndex) => (
                        <Card 
                          key={quizIndex} 
                          draggable
                          onDragStart={() => { dragItem.current = quizIndex; setDraggingItem({type: 'quiz', index: quizIndex}); }}
                          onDragEnter={() => (dragOverItem.current = quizIndex)}
                          onDragEnd={handleQuizSort}
                          onDragOver={(e) => e.preventDefault()}
                          className={`bg-blue-50 dark:bg-blue-900/20 cursor-grab transition-all 
                            ${draggingItem?.type === 'quiz' && draggingItem?.index === quizIndex ? 'opacity-50 shadow-2xl' : 'opacity-100'}
                            ${dragOverItem.current === quizIndex ? 'border-2 border-red-400' : ''}`}
                        >
                          <CardContent className="pt-6 space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-center gap-2">
                                <GripVertical className="w-5 h-5 text-gray-400" />
                                <span className="font-semibold">Cuestionario {quizIndex + 1}</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1">
                                <Button
                                  onClick={() => removeQuiz(quizIndex)}
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50"
                                >
                                  Eliminar
                                </Button>
                              </div>
                            </div>
                            <Input
                              value={quiz.title}
                              onChange={(e) => updateQuiz(quizIndex, 'title', e.target.value)}
                              placeholder="Título del cuestionario"
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
            {user.user_type !== 'formador' && (
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <Label>Filtrar por categoría:</Label>
                  <Select value={assignCategoryFilter} onValueChange={setAssignCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-6 mt-4">
                  <div>
                    <Label className="text-base font-semibold mb-3 block">Selecciona Contenido</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-3">
                      {filteredContentsForAssignment.map((content) => (
                        <div key={content.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
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
                          <div key={rep.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
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
            )}
          </div>
        </div>
      </div>

      {/* Contenidos */}
      <Card className="bg-white dark:bg-gray-800/50">
        <CardHeader>
          <CardTitle>Contenidos Creados ({filteredContents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContents.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              {contents.length > 0 ? 'No hay contenidos que coincidan con los filtros actuales.' : 'No hay contenidos creados aún.'}
            </p>
          ) : (
            <div className="space-y-4">
              {filteredContents.map((content) => (
                <Card key={content.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-lg mb-2">{content.title}</h3>
                        {content.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">{content.description}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          content.status === 'published' 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' 
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
                        }`}>
                          {content.status === 'published' ? 'Publicado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                    {content.is_public && (
                      <div className="mb-2">
                        <span className="text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 px-2 py-1 rounded-full">Público</span>
                      </div>
                    )}
                    {getCategoryNames(content.category_ids).length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {getCategoryNames(content.category_ids).map(name => (
                          <span key={name} className="text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 px-2 py-1 rounded-full">{name}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mt-4">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{content.files.length} archivos</span>
                        <span className="flex items-center gap-1"><HelpCircle className="w-4 h-4" />{content.quizzes.length} cuestionarios</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {user.user_type !== 'formador' && content.status === 'pending' && (
                          <>
                            <Button onClick={() => handleApproveContent(content.id)} variant="ghost" size="sm" className="text-green-600 hover:text-green-700"><Check className="w-4 h-4 mr-2" /> Aprobar</Button>
                            <Button onClick={() => handleRejectContent(content.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700"><X className="w-4 h-4 mr-2" /> Rechazar</Button>
                          </>
                        )}
                        <Button onClick={() => navigate(`/content/${content.id}?preview=true`)} variant="ghost" size="sm">
                          <Eye className="w-4 h-4 mr-2" />
                          Vista Previa
                        </Button>
                        {user.user_type !== 'formador' && (
                          <Button onClick={() => handleDeleteContent(content.id)} variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gestión de Categorías */}
      {user.user_type !== 'formador' && (
      <Card className="bg-white dark:bg-gray-800/50 mt-0"> {/* Quitamos margen extra arriba */}
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            Gestión de Categorías ({categories.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length > 0 ? (
            <div className="space-y-2">
              {categories.map(category => (
                <div key={category.id} className="flex flex-col gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-medium">{category.name}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditCategory(category)}>
                      <Edit className="w-4 h-4 mr-2" /> Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 dark:hover:bg-red-900/50" onClick={() => setDeleteCategory(category)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">No hay categorías creadas.</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* Diálogos de edición y borrado de categoría */}
      <Dialog open={!!editCategory} onOpenChange={() => setEditCategory(null)}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label htmlFor="edit-category-name">Nombre de la categoría</Label>
            <Input id="edit-category-name" value={editCategory?.name || ''} onChange={(e) => setEditCategory({...editCategory, name: e.target.value})} />
          </div>
          <Button onClick={handleUpdateCategory} className="w-full">Guardar Cambios</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCategory} onOpenChange={() => setDeleteCategory(null)}>
        <DialogContent className="bg-white dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <p>
            ¿Estás seguro de que quieres eliminar la categoría "<strong>{deleteCategory?.name}</strong>"? Esta acción no se puede deshacer.
          </p>
          <div className="flex justify-end gap-4 mt-4">
            <Button variant="ghost" onClick={() => setDeleteCategory(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteCategory}>Eliminar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (!showHeader) {
    return dashboardContent;
  }

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
    >
      {dashboardContent}
    </DashboardLayout>
  );
}
