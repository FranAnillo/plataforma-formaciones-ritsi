import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { toast } from 'sonner';
import { api, fetchAllData } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import ContentAssignmentDialog from '../components/training/ContentAssignmentDialog';

export default function CoordinadorTematicoDashboard({ user, onLogout }) {
  const [representatives, setRepresentatives] = useState([]);
  const [contents, setContents] = useState([]);
  const [thematicCommissions, setThematicCommissions] = useState([]);
  const [loading, setLoading] = useState(true);

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
  const publishedContents = contents.filter(content => content.status === 'published');

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      pageTitle="Panel de Vocalía"
      pageDescription="Consulta tu vocalía y asigna formaciones."
      pageActions={(
        <ContentAssignmentDialog
          open={assignContentDialogOpen}
          onOpenChange={setAssignContentDialogOpen}
          trigger={(
            <Button className="bg-[#da2724] hover:bg-[#b8211e]">
              <Plus className="mr-2 h-4 w-4" />
              Asignar Formación
            </Button>
          )}
          title="Asignar Formación"
          description="Selecciona el contenido y los representantes a los que deseas asignarlo."
          contents={publishedContents}
          selectedContentId={selectedContent}
          onSelectContent={setSelectedContent}
          contentMaxHeightClass="max-h-48"
          representatives={representatives}
          selectedUserIds={selectedUsersForContent}
          onSelectedUserIdsChange={setSelectedUsersForContent}
          representativeIdPrefix="content-rep"
          confirmLabel="Asignar Formación"
          onConfirm={handleAssignContent}
        />
      )}
    >
      <Card className="bg-white/85 dark:bg-gray-900/70">
        <CardHeader>
          <CardTitle>Vocalías</CardTitle>
          <CardDescription>Las vocalías no tienen representantes asociados.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {myVocalias.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No tienes ninguna vocalía asignada.</p>
          ) : myVocalias.map(vocalia => (
            <Card key={vocalia.id} className="border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/35">
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
    </DashboardLayout>
  );
}
