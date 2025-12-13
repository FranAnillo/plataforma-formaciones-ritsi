import { useState, useEffect, useCallback } from 'react';
import { LogOut, User, Users, Plus, Edit } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
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

  // State for assigning users to commissions
  const [assignToCommission, setAssignToCommission] = useState(null);
  const [selectedUsersForCommission, setSelectedUsersForCommission] = useState([]);

  // State for assigning content
  const [assignContentDialogOpen, setAssignContentDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState(null);
  const [selectedUsersForContent, setSelectedUsersForContent] = useState([]);

  const fetchData = useCallback(async () => {
    try {
      const [repsRes, contentsRes, commissionsRes] = await fetchAllData([
        '/representatives',
        '/content',
        '/thematic-commissions'
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

  const handleOpenAssignToCommission = (commission) => {
    setAssignToCommission(commission);
    const currentMemberIds = representatives
      .filter(rep => rep.thematic_commission_ids?.includes(commission.id))
      .map(rep => rep.id);
    setSelectedUsersForCommission(currentMemberIds);
  };

  const handleAssignUsersToCommission = async () => {
    if (!assignToCommission) return;
    try {
      await api.put(`/thematic-commissions/${assignToCommission.id}/assign-users`, {
        user_ids: selectedUsersForCommission
      });
      toast.success(`Representantes asignados a "${assignToCommission.name}"`);
      setAssignToCommission(null);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al asignar representantes');
    }
  };

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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo Plataforma Formativa" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold">Plataforma Formativa</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type]}</p>
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
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Panel del Coordinador Temático</h2>
            <p className="text-gray-600 dark:text-gray-400">Gestiona comisiones y asigna formaciones.</p>
          </div>
          <Button onClick={() => setAssignContentDialogOpen(true)} className="bg-[#da2724] hover:bg-[#b8211e]">
            <Plus className="w-4 h-4 mr-2" />
            Asignar Formación
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Comisiones Temáticas</CardTitle>
            <CardDescription>Gestiona los miembros de cada comisión temática.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {thematicCommissions.map(commission => (
              <Card key={commission.id} className="bg-gray-50 dark:bg-gray-800/50">
                <CardHeader>
                  <CardTitle className="text-lg">{commission.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {representatives.filter(r => r.thematic_commission_ids.includes(commission.id)).length} miembros
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => handleOpenAssignToCommission(commission)}>
                    <Edit className="w-4 h-4 mr-2" /> Gestionar Miembros
                  </Button>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Assign Users to Commission Dialog */}
        <Dialog open={!!assignToCommission} onOpenChange={() => setAssignToCommission(null)}>
          <DialogContent className="max-w-lg bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Asignar a "{assignToCommission?.name}"</DialogTitle>
              <CardDescription>Selecciona los representantes que pertenecerán a esta comisión.</CardDescription>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
              {representatives.map(rep => (
                <div key={rep.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Checkbox
                    id={`assign-rep-${rep.id}`}
                    checked={selectedUsersForCommission.includes(rep.id)}
                    onCheckedChange={(checked) => {
                      const newSelection = checked
                        ? [...selectedUsersForCommission, rep.id]
                        : selectedUsersForCommission.filter(id => id !== rep.id);
                      setSelectedUsersForCommission(newSelection);
                    }}
                  />
                  <Label htmlFor={`assign-rep-${rep.id}`} className="cursor-pointer flex-1">
                    <p className="font-medium">{rep.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{rep.email}</p>
                  </Label>
                </div>
              ))}
            </div>
            <Button onClick={handleAssignUsersToCommission} className="w-full">Guardar Asignaciones</Button>
          </DialogContent>
        </Dialog>

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