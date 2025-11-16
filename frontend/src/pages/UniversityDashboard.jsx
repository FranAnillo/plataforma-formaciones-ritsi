import { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, Users, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UniversityDashboard({ user, onLogout }) {
  const [representatives, setRepresentatives] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [repsRes, contentsRes] = await Promise.all([
        axios.get(`${API}/representatives`),
        axios.get(`${API}/content`)
      ]);
      setRepresentatives(repsRes.data);
      setContents(contentsRes.data);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignContent = async () => {
    if (!selectedContent || selectedUsers.length === 0) {
      toast.error('Selecciona contenido y al menos un representante');
      return;
    }

    try {
      await axios.post(`${API}/assignments`, {
        content_id: selectedContent,
        user_ids: selectedUsers
      });
      
      toast.success('Contenido asignado exitosamente');
      setDialogOpen(false);
      setSelectedContent(null);
      setSelectedUsers([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar contenido');
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo de Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold">Plataforma Formativa</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Universidad</p>
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Representantes</h2>
            <p className="text-gray-600 dark:text-gray-400">Asigna contenido formativo a tus representantes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="assign-content-button" className="bg-[#da2724] hover:bg-[#b8211e]">
                <Plus className="w-4 h-4 mr-2" />
                Asignar Contenido
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
              <DialogHeader>
                <DialogTitle>Asignar Contenido Formativo</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                <div>
                  <Label className="text-base font-semibold mb-3 block">Selecciona Contenido</Label>
                  <div className="space-y-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-3">
                    {contents.map((content) => (
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
                            <p className="text-sm text-gray-500 dark:text-gray-400">{rep.email}</p>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  data-testid="confirm-assign-button"
                  onClick={handleAssignContent}
                  className="w-full bg-[#da2724] hover:bg-[#b8211e]"
                >
                  Asignar a Seleccionados
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          <Card className="bg-white dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Mis Representantes ({representatives.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {representatives.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">No hay representantes registrados aún</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {representatives.map((rep) => (
                    <Card key={rep.id} className="hover:shadow-lg transition-shadow bg-white dark:bg-gray-800">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                          {rep.picture ? (
                            <img src={rep.picture} alt={rep.name} className="w-12 h-12 rounded-full" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                              <User className="w-6 h-6 text-[#da2724]" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{rep.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{rep.email}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Contenidos Disponibles ({contents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contents.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-400 text-center py-8">No hay contenidos disponibles</p>
              ) : (
                <div className="space-y-3">
                  {contents.map((content) => (
                    <div key={content.id} className="border dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <h4 className="font-semibold">{content.title}</h4>
                      {content.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{content.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                        <span>{content.files.length} archivos</span>
                        <span>•</span>
                        <span>{content.quizzes.length} cuestionarios</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}