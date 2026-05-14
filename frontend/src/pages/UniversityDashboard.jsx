import { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, Users, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { roleNames } from '../utils/roles';
import { api, fetchAllData } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

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
      const [repsRes, contentsRes] = await fetchAllData([
        '/representatives',
        '/content'
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
      await api.post('/assignments', {
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
    return <LoadingSpinner />;
  }

  return (
    <div className="app-page min-h-screen text-gray-800 transition-colors duration-300 ease-in-out dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/85">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo de Gestión de Formaciones RITSI" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">Gestión de Formaciones RITSI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <ThemeToggleButton />
            <div className="flex min-w-0 max-w-[14rem] items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 sm:px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="truncate text-sm font-medium">{user.name}</span>
            </div>
            <Button
              data-testid="logout-button"
              onClick={onLogout}
              variant="ghost"
              size="sm"
              className="hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Gestión de Representantes</h2>
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
          <Card className="bg-white/85 dark:bg-gray-900/70">
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
                    <Card key={rep.id} className="border-gray-200 bg-white transition-shadow hover:border-red-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-950/35">
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
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{rep.email}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/85 dark:bg-gray-900/70">
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
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500 dark:text-gray-400">
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
