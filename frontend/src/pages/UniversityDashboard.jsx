import { useState, useEffect } from 'react';
import { BookOpen, Plus, Users } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';
import { api, fetchAllData } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import LoadingSpinner from '../components/LoadingSpinner';
import ContentAssignmentDialog from '../components/training/ContentAssignmentDialog';
import ContentSummaryList from '../components/training/ContentSummaryList';
import RepresentativeGrid from '../components/training/RepresentativeGrid';

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
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      pageTitle="Gestión de Representantes"
      pageDescription="Asigna contenido formativo a tus representantes."
      pageActions={(
        <ContentAssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={(
            <Button data-testid="assign-content-button" className="bg-[#da2724] hover:bg-[#b8211e]">
              <Plus className="mr-2 h-4 w-4" />
              Asignar Contenido
            </Button>
          )}
          title="Asignar Contenido Formativo"
          contents={contents}
          selectedContentId={selectedContent}
          onSelectContent={setSelectedContent}
          contentMaxHeightClass="max-h-48"
          representatives={representatives}
          selectedUserIds={selectedUsers}
          onSelectedUserIdsChange={setSelectedUsers}
          showRepresentativeEmail
          confirmLabel="Asignar a Seleccionados"
          confirmTestId="confirm-assign-button"
          onConfirm={handleAssignContent}
        />
      )}
    >
      <div className="grid gap-6">
        <Card className="bg-white/85 dark:bg-gray-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mis Representantes ({representatives.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RepresentativeGrid representatives={representatives} />
          </CardContent>
        </Card>

        <Card className="bg-white/85 dark:bg-gray-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Contenidos Disponibles ({contents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ContentSummaryList contents={contents} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
