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

export default function JuntaDashboard({ user, onLogout }) {
  const [representatives, setRepresentatives] = useState([]);
  const [contents, setContents] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
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

  const handleAssignToAll = async () => {
    if (!selectedContent) {
      toast.error('Selecciona un contenido');
      return;
    }

    try {
      await api.post('/assignments', {
        content_id: selectedContent,
        assign_to_all_representatives: true
      });
      
      toast.success('Contenido asignado a todos los representantes');
      setDialogOpen(false);
      setSelectedContent(null);
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
      pageTitle="Junta Directiva"
      pageDescription="Asigna contenido a todos los representantes."
      pageActions={(
        <ContentAssignmentDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          trigger={(
            <Button data-testid="assign-all-button" className="bg-[#da2724] hover:bg-[#b8211e]">
              <Plus className="mr-2 h-4 w-4" />
              Asignar a Todos
            </Button>
          )}
          title="Asignar a Todos los Representantes"
          warning={(
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                El contenido seleccionado será asignado a <strong>todos los representantes</strong> de todas las universidades ({representatives.length} usuarios).
              </p>
            </div>
          )}
          contents={contents}
          selectedContentId={selectedContent}
          onSelectContent={setSelectedContent}
          showContentDescription
          confirmLabel="Asignar a Todos los Representantes"
          confirmTestId="confirm-assign-all-button"
          onConfirm={handleAssignToAll}
        />
      )}
    >
      <div className="grid gap-6">
        <Card className="bg-white/85 dark:bg-gray-900/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Total de Representantes: {representatives.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400">
              Hay {representatives.length} representantes registrados en todas las universidades.
            </p>
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
