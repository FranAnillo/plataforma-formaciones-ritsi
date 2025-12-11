import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../static/1710_Isotipo_Degradado.png';
import { BookOpen, LogOut, User, Plus, FileText, Video, Image as ImageIcon, HelpCircle, Edit, Tag, GripVertical, Eye } from 'lucide-react';
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
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { roleNames } from '../utils/roles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function FormadorDashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const [contents, setContents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Create content form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [files, setFiles] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [quizzes, setQuizzes] = useState([]);

  // Drag and drop state
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  const [draggingItem, setDraggingItem] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [contentsRes, catsRes] = await Promise.all([
        axios.get(`${API}/content`),
        axios.get(`${API}/categories`)
      ]);
      setContents(contentsRes.data || []);
      setCategories(catsRes.data || []);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addFile = () => setFiles([...files, { file_type: 'video', google_drive_url: '', title: '', description: '' }]);
  const updateFile = (index, field, value) => {
    const updatedFiles = [...files];
    updatedFiles[index][field] = value;
    setFiles(updatedFiles);
  };
  const removeFile = (index) => setFiles(files.filter((_, i) => i !== index));

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

  const addQuiz = () => setQuizzes([...quizzes, { title: '', passing_percentage: 70, questions: [] }]);
  const removeQuiz = (quizIndex) => setQuizzes(quizzes.filter((_, i) => i !== quizIndex));

  const handleCreateContent = async () => {
    // (Validations for title, files, quizzes as in EscuelaFormacionDashboard)
    try {
      await axios.post(`${API}/content`, {
        title,
        description,
        is_public: isPublic,
        category_ids: selectedCategories,
        files,
        quizzes
      });
      toast.success('Contenido enviado para validación');
      setCreateDialogOpen(false);
      // Reset form
      setTitle('');
      setDescription('');
      setIsPublic(false);
      setSelectedCategories([]);
      setFiles([]);
      setQuizzes([]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear contenido');
    }
  };

  const getCategoryNames = (categoryIds) => {
    if (!categoryIds || !categories) return [];
    return categoryIds.map(id => categories.find(cat => cat.id === id)?.name).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900">
        <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#da2724] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 dark:text-gray-300">Cargando...</p>
        </div>
      </div>
    );
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
            <Button onClick={onLogout} variant="ghost" size="sm" className="hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="w-4 h-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Panel de Formador</h2>
            <p className="text-gray-600 dark:text-gray-400">Crea y gestiona tus propuestas de contenido formativo.</p>
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#da2724] hover:bg-[#b8211e]">
                <Plus className="w-4 h-4 mr-2" />
                Crear Contenido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-950">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Contenido Formativo</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                {/* Form fields for title, description, is_public, categories, files, quizzes */}
                {/* This is a simplified version. The full form from EscuelaFormacionDashboard can be reused here. */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="content-title">Título *</Label>
                    <Input id="content-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del contenido" />
                  </div>
                  <div>
                    <Label htmlFor="content-description">Descripción</Label>
                    <Textarea id="content-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción del contenido" rows={3} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="is-public" checked={isPublic} onCheckedChange={setIsPublic} />
                    <Label htmlFor="is-public">Sugerir como contenido público</Label>
                  </div>
                </div>

                {/* Files Section (simplified) */}
                <div className="border-t pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">Archivos</h3>
                    <Button onClick={addFile} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" /> Agregar Archivo</Button>
                  </div>
                  <div className="space-y-4">
                    {files.map((file, index) => (
                      <Card key={index} className="bg-gray-50 dark:bg-gray-900 p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium text-sm">Archivo {index + 1}</span>
                          <Button onClick={() => removeFile(index)} size="sm" variant="ghost" className="text-red-600">Eliminar</Button>
                        </div>
                        <div className="space-y-2">
                          <Input value={file.title} onChange={(e) => updateFile(index, 'title', e.target.value)} placeholder="Título del archivo" />
                          <Input value={file.google_drive_url} onChange={(e) => updateFile(index, 'google_drive_url', e.target.value)} placeholder="URL de Google Drive" />
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>

                <Button onClick={handleCreateContent} className="w-full bg-[#da2724] hover:bg-[#b8211e] py-6">
                  Enviar para Validación
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="bg-white dark:bg-gray-800/50">
          <CardHeader>
            <CardTitle>Mis Contenidos Creados ({contents.filter(c => c.created_by === user.id).length})</CardTitle>
          </CardHeader>
          <CardContent>
            {contents.filter(c => c.created_by === user.id).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">Aún no has creado ningún contenido.</p>
            ) : (
              <div className="space-y-4">
                {contents.filter(c => c.created_by === user.id).map((content) => (
                  <Card key={content.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
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
                            {content.status === 'published' ? 'Publicado' : 'Pendiente de Validación'}
                          </span>
                        </div>
                      </div>
                      {getCategoryNames(content.category_ids).length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {getCategoryNames(content.category_ids).map(name => (
                            <span key={name} className="text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 px-2 py-1 rounded-full">{name}</span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{content.files.length} archivos</span>
                          <span className="flex items-center gap-1"><HelpCircle className="w-4 h-4" />{content.quizzes.length} cuestionarios</span>
                        </div>
                        <div className="flex items-center">
                          <Button onClick={() => navigate(`/content/${content.id}?preview=true`)} variant="ghost" size="sm">
                            <Eye className="w-4 h-4 mr-2" />
                            Vista Previa
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}