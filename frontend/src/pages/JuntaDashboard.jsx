import { useState, useEffect } from 'react';
import { BookOpen, LogOut, User, Users, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

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

  const handleAssignToAll = async () => {
    if (!selectedContent) {
      toast.error('Selecciona un contenido');
      return;
    }

    try {
      await axios.post(`${API}/assignments`, {
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Plataforma Formativa</h1>
              <p className="text-sm text-gray-600">Junta Directiva</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-full">
              <User className="w-4 h-4 text-gray-600" />
              <span className="text-sm text-gray-700">{user.name}</span>
            </div>
            <Button
              data-testid="logout-button"
              onClick={onLogout}
              variant="ghost"
              size="sm"
              className="hover:bg-red-50 hover:text-red-600"
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
            <h2 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'Playfair Display, serif' }}>
              Junta Directiva
            </h2>
            <p className="text-gray-600">Asigna contenido a todos los representantes</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="assign-all-button" className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="w-4 h-4 mr-2" />
                Asignar a Todos
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Asignar a Todos los Representantes</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    El contenido seleccionado será asignado a <strong>todos los representantes</strong> de todas las universidades ({representatives.length} usuarios).
                  </p>
                </div>

                <div>
                  <Label className="text-base font-semibold mb-3 block">Selecciona Contenido</Label>
                  <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                    {contents.map((content) => (
                      <div key={content.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="radio"
                          id={`content-${content.id}`}
                          name="content"
                          checked={selectedContent === content.id}
                          onChange={() => setSelectedContent(content.id)}
                          className="w-4 h-4 text-indigo-600"
                        />
                        <Label htmlFor={`content-${content.id}`} className="cursor-pointer flex-1">
                          <div>
                            <p className="font-medium">{content.title}</p>
                            {content.description && (
                              <p className="text-sm text-gray-500">{content.description}</p>
                            )}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  data-testid="confirm-assign-all-button"
                  onClick={handleAssignToAll}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  Asignar a Todos los Representantes
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Total de Representantes: {representatives.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Hay {representatives.length} representantes registrados en todas las universidades.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Contenidos Disponibles ({contents.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contents.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay contenidos disponibles</p>
              ) : (
                <div className="space-y-3">
                  {contents.map((content) => (
                    <div key={content.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                      <h4 className="font-semibold text-gray-800">{content.title}</h4>
                      {content.description && (
                        <p className="text-sm text-gray-600 mt-1">{content.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
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