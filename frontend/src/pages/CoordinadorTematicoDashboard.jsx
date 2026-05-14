import { useState, useEffect, useCallback } from 'react';
import { LogOut, User, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { roleNames } from '../utils/roles';
import { api, fetchAllData } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CoordinadorTematicoDashboard({ user, onLogout }) {
  const [representatives, setRepresentatives] = useState([]);
  const [contents, setContents] = useState([]);
  const [thematicCommissions, setThematicCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for assigning content
  const [assignContentDialogOpen, setAssignContentDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedUsersForContent, setSelectedUsersForContent] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [repsRes, contentsRes, commissionsRes] = await fetchAllData([
        '/representatives',
        '/content',
        '/vocalias'
      ]);
      setRepresentatives(repsRes.data || []);
      setContents(contentsRes.data || []);
      setThematicCommissions(commissionsRes.data || []);
    } catch (error) {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignContent = async () => {
    if (!selectedContent || selectedUsersForContent.length === 0) {
      toast.error('Selecciona un contenido y al menos un representante');
      return;
    }
    try {
      await api.post('/assignments', {
        content_id: selectedContent,
        user_ids: selectedUsersForContent
      });
      toast.success('Contenido asignado exitosamente');
      setAssignContentDialogOpen(false);
      setSelectedContent(null);
      setSelectedUsersForContent([]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar contenido');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const myVocalias = thematicCommissions.filter(vocalia => vocalia.coordinator_id === user.id);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logo} alt="Logo Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-base sm:text-xl font-bold truncate">Plataforma Formativa</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type]}</p>
            </div>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end sm:gap-3">
            <ThemeToggleButton />
            <div className="flex min-w-0 max-w-[14rem] items-center gap-2 bg-gray-100 dark:bg-gray-800 px-3 sm:px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="truncate text-sm font-medium">{user.name}</span>
            </div>
            <Button onClick={onLogout} variant="ghost" size="sm" className="hover:bg-red-50 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">Panel de Vocalía</h2>
            <p className="text-gray-600 dark:text-gray-400">Consulta tu vocalía y asigna formaciones.</p>
          </div>
          <Button onClick={() => setAssignContentDialogOpen(true)} className="bg-[#da2724] hover:bg-[#b8211e]">
            <Plus className="w-4 h-4 mr-2" />
            Asignar Formación
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vocalías</CardTitle>
            <CardDescription>Las vocalías no tienen representantes asociados.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myVocalias.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">No tienes ninguna vocalía asignada.</p>
            ) : myVocalias.map(vocalia => (
              <Card key={vocalia.id} className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-lg">{vocalia.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Área de trabajo sin representantes asociados.
                  </p>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Assign Content Dialog */}
        <Dialog open={assignContentDialogOpen} onOpenChange={setAssignContentDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Asignar Formación</DialogTitle>
              <CardDescription>Selecciona el contenido y los representantes a los que deseas asignarlo.</CardDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label className="text-base font-semibold mb-3 block">Selecciona Contenido</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border dark:border-gray-700 rounded-lg p-3">
                  {contents.filter(c => c.status === 'published').map((content) => (
                    <div key={content.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                      <input type="radio" id={`content-${content.id}`} name="content" checked={selectedContent === content.id} onChange={() => setSelectedContent(content.id)} />
                      <Label htmlFor={`content-${content.id}`} className="cursor-pointer flex-1">{content.title}</Label>
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
                        id={`content-rep-${rep.id}`}
                        checked={selectedUsersForContent.includes(rep.id)}
                        onCheckedChange={(checked) => {
                          const newSelection = checked ? [...selectedUsersForContent, rep.id] : selectedUsersForContent.filter(id => id !== rep.id);
                          setSelectedUsersForContent(newSelection);
                        }}
                      />
                      <Label htmlFor={`content-rep-${rep.id}`} className="cursor-pointer flex-1">{rep.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={handleAssignContent} className="w-full bg-[#da2724] hover:bg-[#b8211e]">Asignar Formación</Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
