import { useState, useEffect, useRef } from 'react';
import { LogOut, User, Users, Building2, GraduationCap, FileText, Trash2, Eye, MoreVertical, Upload, Download, Clock, Globe, Shield, UserX, ClipboardList, Plus, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Switch } from '../components/ui/switch';
import { Checkbox } from '../components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import EscuelaFormacionDashboard from './EscuelaFormacionDashboard';
import { toast } from 'sonner';
import { roleNames } from '../utils/roles';
import { api, fetchAllData } from '../services/api';
import DashboardLayout from '../components/DashboardLayout';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [thematicCommissions, setThematicCommissions] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewUserContent, setViewUserContent] = useState(null);
  // Commission Management State
  const [commissionSearchQuery, setCommissionSearchQuery] = useState('');
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [editingCommission, setEditingCommission] = useState(null); // null for new, object for editing
  const [commissionName, setCommissionName] = useState('');
  const [commissionCoordinator, setCommissionCoordinator] = useState('');
  const [assignMembersDialogOpen, setAssignMembersDialogOpen] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [commissionSort, setCommissionSort] = useState({ key: 'name', direction: 'asc' });
  const [commissionCurrentPage, setCommissionCurrentPage] = useState(1);
  const commissionsPerPage = 5;
  const usersPerPage = 10;
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('stats');
  const [initialContentFilter, setInitialContentFilter] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Reset to the first page whenever filters change
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterStatus]);

  useEffect(() => {
    setCommissionCurrentPage(1);
  }, [commissionSearchQuery]);

  useEffect(() => {
    if (activeTab !== 'content') {
      setInitialContentFilter(null);
    }
  }, [activeTab]);

  const fetchData = async () => {
    try {
      // Need to fetch all users, not just representatives
      const [usersRes, unisRes, contentsRes, assignmentsRes, commissionsRes, logRes] = await fetchAllData([
        '/users',
        '/universities',
        '/content',
        '/assignments',
        '/thematic-commissions',
        '/activity-log'
      ]);
      
      const allUsers = usersRes.data || [];
      const allContents = contentsRes.data || [];
      setUsers(allUsers);
      setUniversities(unisRes.data || []);
      setThematicCommissions(commissionsRes.data || []);
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
      await api.post('/assignments/unassign', { user_id: userId, content_id: contentId });
      toast.success('Formación retirada exitosamente');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al retirar la formación');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}/role`, { user_type: newRole });
      toast.success('Rol de usuario actualizado');
      fetchData(); // Refresh data
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar el rol');
    }
  };

  const handleStatusChange = async (userId, isActive) => {
    try {
      await api.put(`/users/${userId}/status`, { is_active: isActive });
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
        const response = await api.post('/users/import', { users: usersToImport });
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

  const handleContentStatCardClick = (filter) => {
    setInitialContentFilter(filter);
    setActiveTab('content');
  };

  const handleOpenCommissionDialog = (commission = null) => {
    setEditingCommission(commission);
    setCommissionName(commission ? commission.name : '');
    setCommissionCoordinator(commission ? commission.coordinator_id || '' : '');
    setCommissionDialogOpen(true);
  };

  const handleSaveCommission = async () => {
    if (!commissionName.trim()) {
      toast.error('El nombre de la comisión es obligatorio.');
      return;
    }
    const url = editingCommission
      ? `/thematic-commissions/${editingCommission.id}`
      : '/thematic-commissions';
    const method = editingCommission ? 'put' : 'post';
    const data = {
      name: commissionName,
      coordinator_id: commissionCoordinator || null,
    };

    try {
      await apimethod;
      toast.success(`Comisión ${editingCommission ? 'actualizada' : 'creada'} exitosamente.`);
      setCommissionDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al guardar la comisión.');
    }
  };

  const handleOpenAssignMembersDialog = (commission) => {
    const memberIds = users
      .filter(u => u.thematic_commission_ids.includes(commission.id))
      .map(u => u.id);
    setSelectedMembers(memberIds);
    setAssignMembersDialogOpen(commission);
  };

  const handleSaveMembers = async () => {
    if (!assignMembersDialogOpen) return;
    try {
      await api.put(`/thematic-commissions/${assignMembersDialogOpen.id}/assign-users`, {
        user_ids: selectedMembers,
      });
      toast.success('Miembros de la comisión actualizados.');
      setAssignMembersDialogOpen(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar miembros.');
    }
  };

  const handleDeleteCommission = async (commissionId) => {
    try {
      await api.delete(`/thematic-commissions/${commissionId}`);
      toast.success('Comisión eliminada exitosamente.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al eliminar la comisión.');
    }
  };

  const handleCommissionSort = (key) => {
    setCommissionSort(prevSort => {
      if (prevSort.key === key) {
        return { key, direction: prevSort.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const filteredUsers = users.filter(u => 
    (filterRole === 'all' || u.user_type === filterRole) &&
    (filterStatus === 'all' || u.is_active === (filterStatus === 'active')) &&
    (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase())));

  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  const indexOfLastCommission = commissionCurrentPage * commissionsPerPage;
  const indexOfFirstCommission = indexOfLastCommission - commissionsPerPage;
  const filteredCommissions = thematicCommissions
    .filter(c => 
      c.name.toLowerCase().includes(commissionSearchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const key = commissionSort.key;
      const direction = commissionSort.direction === 'asc' ? 1 : -1;

      let valA = key === 'name' ? a.name.toLowerCase() : users.filter(u => u.thematic_commission_ids.includes(a.id)).length;
      let valB = key === 'name' ? b.name.toLowerCase() : users.filter(u => u.thematic_commission_ids.includes(b.id)).length;

      if (valA < valB) {
        return -1 * direction;
      }
      if (valA > valB) {
        return 1 * direction;
      }
      return 0;
    });
  const currentCommissions = filteredCommissions.slice(indexOfFirstCommission, indexOfLastCommission);
  const totalCommissionPages = Math.ceil(filteredCommissions.length / commissionsPerPage);

  const coordinatorCandidates = users.filter(u => u.user_type === 'coordinador_tematico' && u.is_active);
  const getUserName = (userId) => users.find(u => u.id === userId)?.name || 'Sin asignar';

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  };

  if (loading) {
    return <LoadingSpinner message="Cargando panel..." />;
  }

  return (
    <DashboardLayout
      user={user}
      onLogout={onLogout}
      pageTitle="Panel de Administración"
      pageDescription="Gestión completa de la plataforma"
    >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
            <TabsTrigger value="users">Gestión de Usuarios</TabsTrigger>
            <TabsTrigger value="content">Gestión de Contenidos</TabsTrigger>
            <TabsTrigger value="commissions">Comisiones</TabsTrigger>
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
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleContentStatCardClick(null)}>
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
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleContentStatCardClick({ status: 'pending' })}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.pendingContents}</span>
                  </div>
                  <p className="text-red-100">Contenidos Pendientes</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => handleContentStatCardClick({ is_public: true })}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <Globe className="w-8 h-8 opacity-80" />
                    <span className="text-3xl font-bold">{stats.publicContents}</span>
                  </div>
                  <p className="text-red-100">Contenidos Públicos</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-[#da2724] to-[#e97c7a] text-white cursor-pointer hover:scale-105 transition-transform" onClick={() => setActiveTab('commissions')}>
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
                      <SelectItem value="all">Todos los Roles</SelectItem>
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
                      <SelectItem value="all">Todos los Estados</SelectItem>
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
            <EscuelaFormacionDashboard user={user} onLogout={onLogout} showHeader={false} initialFilter={initialContentFilter} />
          </TabsContent>
          <TabsContent value="commissions" className="mt-6">
            <Card className="bg-white dark:bg-gray-800/50">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Gestión de Comisiones Temáticas</CardTitle>
                    <CardDescription>Crea, edita y gestiona las comisiones y sus miembros.</CardDescription>
                  </div>
                  <Button onClick={() => handleOpenCommissionDialog()}>
                    <Plus className="w-4 h-4 mr-2" /> Crear Comisión
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    placeholder="Buscar comisión por nombre..."
                    value={commissionSearchQuery}
                    onChange={(e) => setCommissionSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => handleCommissionSort('name')}>
                          Comisión {commissionSort.key === 'name' && (commissionSort.direction === 'asc' ? <ArrowUp className="inline w-4 h-4 ml-1" /> : <ArrowDown className="inline w-4 h-4 ml-1" />)}
                        </TableHead>
                        <TableHead>Coordinador/a</TableHead>
                        <TableHead className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => handleCommissionSort('members')}>
                          Miembros {commissionSort.key === 'members' && (commissionSort.direction === 'asc' ? <ArrowUp className="inline w-4 h-4 ml-1" /> : <ArrowDown className="inline w-4 h-4 ml-1" />)}
                        </TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentCommissions.map(commission => (
                        <TableRow key={commission.id}>
                          <TableCell className="font-medium">{commission.name}</TableCell>
                          <TableCell>{getUserName(commission.coordinator_id)}</TableCell>
                          <TableCell>{users.filter(u => u.thematic_commission_ids.includes(commission.id)).length}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Abrir menú</span>
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenAssignMembersDialog(commission)}>Gestionar Miembros</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenCommissionDialog(commission)}>Editar Comisión</DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteCommission(commission.id)}>Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {thematicCommissions.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No hay comisiones temáticas creadas.
                  </p>
                )}
                <div className="flex items-center justify-end space-x-2 py-4">
                  <span className="text-sm text-muted-foreground">
                    Página {commissionCurrentPage} de {totalCommissionPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCommissionCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={commissionCurrentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCommissionCurrentPage(prev => Math.min(prev + 1, totalCommissionPages))} disabled={commissionCurrentPage === totalCommissionPages}>
                    Siguiente
                  </Button>
                </div>
              </CardContent>
            </Card>
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
                            {log.details?.commission_name && (
                              <div>
                                <div>Comisión: <strong>{log.details.commission_name}</strong></div>
                                {log.details.added?.length > 0 && <div className="text-green-600">Añadidos: {log.details.added.join(', ')}</div>}
                                {log.details.removed?.length > 0 && <div className="text-red-600">Eliminados: {log.details.removed.join(', ')}</div>}
                              </div>
                            )}
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

        {/* Create/Edit Commission Dialog */}
        <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>{editingCommission ? 'Editar' : 'Crear'} Comisión Temática</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div>
                <Label htmlFor="commission-name">Nombre de la Comisión</Label>
                <Input id="commission-name" value={commissionName} onChange={(e) => setCommissionName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="commission-coordinator">Coordinador/a</Label>
                <Select value={commissionCoordinator} onValueChange={setCommissionCoordinator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar coordinador/a" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin asignar</SelectItem>
                    {coordinatorCandidates.map(user => (
                      <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Solo se muestran usuarios con el rol 'Coordinador Temático'.</p>
              </div>
            </div>
            <Button onClick={handleSaveCommission} className="w-full">{editingCommission ? 'Guardar Cambios' : 'Crear Comisión'}</Button>
          </DialogContent>
        </Dialog>

        {/* Assign Members Dialog */}
        <Dialog open={!!assignMembersDialogOpen} onOpenChange={() => setAssignMembersDialogOpen(null)}>
          <DialogContent className="max-w-lg bg-white dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle>Gestionar Miembros de "{assignMembersDialogOpen?.name}"</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-2 max-h-96 overflow-y-auto">
              {users
                .filter(u => 
                  u.is_active && // Must be active
                  u.id !== assignMembersDialogOpen?.coordinator_id // Cannot be the coordinator of this commission
                ).map(rep => (
                <div key={rep.id} className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800">
                  <Checkbox
                    id={`member-rep-${rep.id}`}
                    checked={selectedMembers.includes(rep.id)}
                    onCheckedChange={(checked) => {
                      const newSelection = checked
                        ? [...selectedMembers, rep.id]
                        : selectedMembers.filter(id => id !== rep.id);
                      setSelectedMembers(newSelection);
                    }}
                  />
                  <Label htmlFor={`member-rep-${rep.id}`} className="cursor-pointer flex-1">{rep.name}</Label>
                </div>
              ))}
            </div>
            <Button onClick={handleSaveMembers} className="w-full">Guardar Miembros</Button>
          </DialogContent>
        </Dialog>
    </DashboardLayout>
  );
}
