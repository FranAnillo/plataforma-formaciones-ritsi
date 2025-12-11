import { useState, useEffect, useRef } from 'react';
import { LogOut, User, Users, Building2, GraduationCap, FileText, Trash2, Eye, MoreVertical, Upload, Download, Clock, Globe, Shield, UserX, ClipboardList } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import EscuelaFormacionDashboard from './EscuelaFormacionDashboard';
import axios from 'axios';
import { ThemeToggleButton } from '../components/ThemeToggleButton';
import { toast } from 'sonner';
import logo from '../static/1710_Isotipo_Degradado.png';
import { roleNames } from '../utils/roles';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard({ user, onLogout }) {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalRepresentatives: 0,
    totalUniversities: 0,
    totalContents: 0,
    totalFormadores: 0,
    pendingContents: 0,
    publicContents: 0,
    totalCommissions: 0,
    inactiveUsers: 0,
    totalAssignments: 0,
  });
  const [users, setUsers] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [contents, setContents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewUserContent, setViewUserContent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 10;
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('stats');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Reset to the first page whenever filters change
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterStatus]);

  const fetchData = async () => {
    try {
      // Need to fetch all users, not just representatives
      const [usersRes, unisRes, contentsRes, assignmentsRes, commissionsRes, logRes] = await Promise.all([
        axios.get(`${API}/users`), // Assuming an endpoint to get all users exists
        axios.get(`${API}/universities`),
        axios.get(`${API}/content`),
        axios.get(`${API}/assignments`), // Assuming an endpoint to get all assignments
        axios.get(`${API}/thematic-commissions`),
        axios.get(`${API}/activity-log`)
      ]);
      
      const allUsers = usersRes.data || [];
      const allContents = contentsRes.data || [];
      setUsers(allUsers);
      setUniversities(unisRes.data || []);
      setContents(allContents);
      setActivityLog(logRes.data || []);
      setAssignments(assignmentsRes.data || []);

      setStats({
        totalUsers: allUsers.length,
        totalRepresentatives: allUsers.filter(u => u.user_type === 'representante').length,
        totalFormadores: allUsers.filter(u => u.user_type === 'formador').length,
        pendingContents: allContents.filter(c => c.status === 'pending').length,
        publicContents: allContents.filter(c => c.is_public).length,
        totalCommissions: (commissionsRes.data || []).length,
        inactiveUsers: allUsers.filter(u => !u.is_active).length,
        totalAssignments: (assignmentsRes.data || []).length,
        totalUniversities: (unisRes.data || []).length,
        totalContents: (contentsRes.data || []).length
      });
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const getAssignedContentForUser = (userId) => {
    const assignedContentIds = new Set();
    assignments.forEach(a => {
      if (a.assigned_to_all_representatives || a.assigned_to_user_ids.includes(userId)) {
        assignedContentIds.add(a.content_id);
      }
    });
    return contents.filter(c => assignedContentIds.has(c.id));
  };

  const handleUnassign = async (userId, contentId) => {
    try {
      await axios.post(`${API}/assignments/unassign`, { user_id: userId, content_id: contentId });
      toast.success('Formación retirada exitosamente');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al retirar la formación');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`${API}/users/${userId}/role`, { user_type: newRole });
      toast.success('Rol de usuario actualizado');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar el rol');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await axios.put(`${API}/users/${userId}/status`, { is_active: isActive });
      toast.success(`Usuario ${isActive ? 'activado' : 'desactivado'}`);
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cambiar el estado del usuario');
    }
  };

  const handleExportCSV = () => {
    const headers = ["email", "name", "user_type", "university_id"];
    const csvRows = [
      headers.join(','),
      ...filteredUsers.map(user => 
        [
          user.email,
          `"${user.name.replace(/"/g, '""')}"`, // Handle names with quotes
          user.user_type,
          user.university_id || ''
        ].join(',')
      )
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `export_usuarios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split('\n').slice(1); // Skip header
      const usersToImport = rows.map(row => {
        const [email, name, user_type, university_id] = row.split(',');
        return { email, name, user_type, university_id: university_id || null };
      }).filter(u => u.email); // Filter out empty rows

      try {
        const response = await axios.post(`${API}/users/import`, { users: usersToImport });
        const { created, skipped, errors } = response.data;
        let message = `Importación completada: ${created} usuarios creados, ${skipped} omitidos.`;
        if (errors.length > 0) {
          message += ` Errores: ${errors.join(', ')}`;
          toast.warning(message, { duration: 10000 });
        } else {
          toast.success(message);
        }
        fetchData();
      } catch (error) {
        toast.error(error.response?.data?.detail || 'Error al importar usuarios');
      }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = null;
  };

  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const getUniversityName = (uniId) => universities.find(u => u.id === uniId)?.name || 'N/A';

  const handleStatCardClick = (tab, role, status) => {
    setActiveTab(tab);
    setFilterRole(role);
    setFilterStatus(status);
  };

  const filteredUsers = users.filter(u => 
    (filterRole === 'all' || u.user_type === filterRole) &&
    (filterStatus === 'all' || u.is_active === (filterStatus === 'active')) &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())));

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center" style={{ fontFamily: 'Exo, sans-serif' }}>
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#da2724] mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300 ease-in-out" style={{ fontFamily: 'Exo, sans-serif' }}>
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo de Gestión de Formaciones RITSI" className="w-10 h-10 rounded-xl object-cover" />
            <div>
              <h1 className="text-xl font-bold">Gestión de Formaciones RITSI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{roleNames[user.user_type] || 'Usuario'}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggleButton />
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-full transition-colors">
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
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Panel de Administración
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Gestión completa de la plataforma</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
            <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
            <TabsTrigger value="content">Gestión de Contenidos</TabsTrigger>
            <TabsTrigger value="activity">Registro de Actividad</TabsTrigger>
          </TabsList>

          <TabsContent value="stats" className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleStatCardClick('users', 'all', 'all')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalUsers}</span>
                  </div>
                  <p className="text-red-100">Usuarios Totales</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Building2 className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalUniversities}</span>
                  </div>
                  <p className="text-red-100">Universidades</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveTab('content')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <FileText className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalContents}</span>
                  </div>
                  <p className="text-red-100">Contenidos</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleStatCardClick('users', 'representante', 'all')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <GraduationCap className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalRepresentatives}</span>
                  </div>
                  <p className="text-red-100">Representantes</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleStatCardClick('users', 'formador', 'all')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Shield className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalFormadores}</span>
                  </div>
                  <p className="text-red-100">Formadores</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveTab('content')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.pendingContents}</span>
                  </div>
                  <p className="text-red-100">Contenidos Pendientes</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveTab('content')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Globe className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.publicContents}</span>
                  </div>
                  <p className="text-red-100">Contenidos Públicos</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Users className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalCommissions}</span>
                  </div>
                  <p className="text-red-100">Comisiones Temáticas</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleStatCardClick('users', 'all', 'inactive')}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <UserX className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.inactiveUsers}</span>
                  </div>
                  <p className="text-red-100">Usuarios Inactivos</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <ClipboardList className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.totalAssignments}</span>
                  </div>
                  <p className="text-red-100">Asignaciones Totales</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card className="bg-white dark:bg-gray-800/50">
              <CardHeader>
                <CardTitle>Lista de Usuarios</CardTitle>
                <CardDescription>Gestiona los usuarios, sus roles y formaciones asignadas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <Input 
                    placeholder="Buscar por nombre o email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los roles</SelectItem>
                      {Object.entries(roleNames).map(([key, name]) => (
                        <SelectItem key={key} value={key}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los estados</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="inactive">Inactivo</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="ml-auto flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".csv"
                      onChange={handleImportCSV}
                    />
                    <Button variant="outline" size="sm" onClick={triggerFileSelect}><Upload className="w-4 h-4 mr-2" /> Importar</Button>
                    <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="w-4 h-4 mr-2" /> Exportar</Button>
                  </div>
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuario</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Universidad</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-sm text-muted-foreground">{u.email}</div>
                          </TableCell>
                          <TableCell>
                            <Select value={u.user_type} onValueChange={(newRole) => handleRoleChange(u.id, newRole)}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(roleNames).map(([key, name]) => (
                                  <SelectItem key={key} value={key}>{name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={u.is_active}
                                onCheckedChange={(isChecked) => handleStatusChange(u.id, isChecked)}
                              />
                              <span className={`text-xs font-medium ${u.is_active ? 'text-green-600' : 'text-red-600'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getUniversityName(u.university_id)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setViewUserContent(u)}>Ver Formaciones</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                  <span className="text-sm text-muted-foreground">
                    Página {currentPage} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages}>
                    Siguiente
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="content" className="mt-6">
            <EscuelaFormacionDashboard user={user} onLogout={onLogout} showHeader={false} />
          </TabsContent>
          <TabsContent value="activity" className="mt-6">
            <Card className="bg-white dark:bg-gray-800/50">
              <CardHeader>
                <CardTitle>Registro de Actividad</CardTitle>
                <CardDescription>Auditoría de cambios importantes en la plataforma.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Administrador</TableHead>
                        <TableHead>Acción</TableHead>
                        <TableHead>Usuario Afectado</TableHead>
                        <TableHead>Detalles</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLog.map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                          <TableCell>{log.actor_name}</TableCell>
                          <TableCell>{log.action}</TableCell>
                          <TableCell>{log.target_user_name}</TableCell>
                          <TableCell>
                            {log.details?.from && `De '${roleNames[log.details.from]}' a '${roleNames[log.details.to]}'`}
                            {log.details?.status && `Usuario ${log.details.status}`}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* View User Content Dialog */}
        <Dialog open={!!viewUserContent} onOpenChange={() => setViewUserContent(null)}>
          <DialogContent className="max-w-lg bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Formaciones de {viewUserContent?.name}</DialogTitle>
              <CardDescription>Aquí puedes ver y retirar las formaciones asignadas a este usuario.</CardDescription>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-80 overflow-y-auto">
              {viewUserContent && getAssignedContentForUser(viewUserContent.id).length > 0 ? (
                getAssignedContentForUser(viewUserContent.id).map(content => (
                  <div key={content.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <span className="font-medium">{content.title}</span>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleUnassign(viewUserContent.id, content.id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Retirar
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center text-gray-500 py-8">Este usuario no tiene formaciones asignadas.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
