import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Award, BarChart3, Bell, BookOpen, Building2, CalendarDays, CheckCircle2, ClipboardList, Clock3, Download, ExternalLink, FilePlus2, Globe2, LayoutGrid, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserPlus, Users, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import AccessibleModal from '../components/AccessibleModal';
import DashboardLayout from '../components/DashboardLayout';
import QuizEditor from '../components/QuizEditor';
import { AttendanceManager, EditorialManager, IntegrationOperations, LearningAchievements, NotificationSettings, ReportsOverview, SessionEditor } from '../components/PlatformTools';
import api, { submitPostInNewTab } from '../services/api';
import { boardPositionNames, roleNames } from '../utils/roles';

const SHEET_ID = '1JSRrepNNdQDl6zeroZPDKUJztLhSC3j6r7y2h_ND09c';
const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const positions = [
  'presidencia', 'vicepresidencia_politica_universitaria', 'tesoreria', 'secretaria',
  'vicepresidencia_comunicacion', 'miembro_adicional_1', 'miembro_adicional_2'
];
const emptyFormation = { title: '', description: '', training_date: '', audience: '', duration_minutes: '', trainer_names: '', tags: '', is_public: false, files: [{ title: 'Presentación', url: '', file_type: 'presentation' }], quizzes: [] };
const emptyUser = { name: '', email: '', password: '', user_type: 'representante', university_id: '' };
const emptyVocalia = { name: '', description: '', board_member_id: '' };
const emptyUniversity = { name: '', zone: '' };
const emptyAssignment = { content_id: '', user_ids: [], assign_to_all_representatives: false };
const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
const createEmptySession = () => ({ content_id: '', title: '', starts_at_local: '', duration_minutes: 60, timezone: detectedTimeZone, meeting_url: '', join_window_minutes: 15 });

const arrayPayload = payload => Array.isArray(payload) ? payload : payload?.items || payload?.enrollments || payload?.assignments || [];

async function getFirstAvailable(paths) {
  let lastError;
  for (const path of paths) {
    try {
      return arrayPayload((await api.get(path)).data);
    } catch (error) {
      lastError = error;
      if (![404, 405].includes(error.response?.status)) throw error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = user.user_type === 'admin';
  const isBoard = user.user_type === 'junta_directiva';
  const canAuthor = isAdmin || isBoard || user.user_type === 'formador';
  const canAssign = isAdmin || isBoard || user.user_type === 'universidad';
  const canCreateSessions = isAdmin || isBoard || user.user_type === 'formador';
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'my-learning');
  const [data, setData] = useState({ content: [], vocalias: [], users: [], board: [], universities: [], progress: [], enrollments: [], assignments: [], assignableUsers: [] });
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState([]);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('all');
  const [formation, setFormation] = useState(emptyFormation);
  const [newUser, setNewUser] = useState(emptyUser);
  const [vocalia, setVocalia] = useState(emptyVocalia);
  const [university, setUniversity] = useState(emptyUniversity);
  const [selectedVocalia, setSelectedVocalia] = useState(null);
  const [memberIds, setMemberIds] = useState([]);
  const [boardSlots, setBoardSlots] = useState(positions.slice(0, 5).map(position => ({ position, user_id: '' })));
  const [assignment, setAssignment] = useState(emptyAssignment);
  const [assignmentQuery, setAssignmentQuery] = useState('');
  const [resetTarget, setResetTarget] = useState(null);
  const [passwordResetUrl, setPasswordResetUrl] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionForm, setSessionForm] = useState(createEmptySession);
  const [saving, setSaving] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const load = async () => {
    setLoading(true);
    setLoadErrors([]);
    const requests = [
      { key: 'content', label: 'catálogo', request: api.get('/content').then(response => arrayPayload(response.data)) },
      { key: 'vocalias', label: 'Vocalías', request: api.get('/vocalias').then(response => arrayPayload(response.data)) },
      { key: 'progress', label: 'progreso', request: getFirstAvailable(['/progress/me', '/progress']) },
      { key: 'enrollments', label: 'Mi formación', request: getFirstAvailable(['/assignments/me', '/enrollments/mine', '/assignments/mine']) },
    ];
    if (isAdmin || isBoard) {
      requests.push(
        { key: 'users', label: 'usuarios', request: api.get('/users').then(response => arrayPayload(response.data)) },
        { key: 'board', label: 'Junta Directiva', request: api.get('/board').then(response => arrayPayload(response.data)) },
      );
    }
    if (isAdmin) requests.push({ key: 'universities', label: 'universidades', request: api.get('/universities').then(response => arrayPayload(response.data)) });
    if (canAssign) {
      requests.push(
        { key: 'assignments', label: 'asignaciones', request: api.get('/assignments').then(response => arrayPayload(response.data)) },
        { key: 'assignableUsers', label: 'destinatarios', request: getFirstAvailable(['/assignments/eligible-users', '/users/assignable']) },
      );
    }

    const responses = await Promise.allSettled(requests.map(item => item.request));
    const next = { ...data };
    const errors = [];
    responses.forEach((response, index) => {
      const descriptor = requests[index];
      if (response.status === 'fulfilled') next[descriptor.key] = response.value;
      else errors.push({ area: descriptor.label, message: response.reason?.response?.data?.detail || `No se pudo cargar ${descriptor.label}` });
    });

    setData(next);
    setLoadErrors(errors);
    if (errors.length) toast.warning(`Hay ${errors.length} sección${errors.length === 1 ? '' : 'es'} sin actualizar`);
    if (next.board.length) {
      const configured = positions.slice(0, 5).map(position => ({ position, user_id: next.board.find(item => item.board_position === position)?.id || '' }));
      next.board.filter(item => item.board_position?.startsWith('miembro_adicional')).forEach(item => configured.push({ position: item.board_position, user_id: item.id }));
      setBoardSlots(configured);
    }
    setLoading(false);
  };

  const loadSessions = async () => {
    setSessionsLoading(true);
    setSessionsError('');
    try {
      const response = await api.get('/sessions');
      setSessions(arrayPayload(response.data));
    } catch (error) {
      setSessionsError(error.response?.data?.detail || 'No se pudieron cargar las sesiones.');
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => { load(); loadSessions(); }, []);
  useEffect(() => {
    let active = true;
    const refreshUnread = async () => {
      try {
        const items = arrayPayload((await api.get('/notifications')).data);
        if (active) setUnreadNotifications(items.filter(item => !item.read_at).length);
      } catch { /* La carga general muestra los errores de sesión o conectividad. */ }
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const years = useMemo(() => [...new Set(data.content.map(item => item.academic_year).filter(Boolean))], [data.content]);
  const filtered = useMemo(() => data.content.filter(item => {
    const text = `${item.title} ${item.description || ''} ${(item.tags || []).join(' ')} ${(item.trainer_names || []).join(' ')}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (year === 'all' || item.academic_year === year);
  }), [data.content, query, year]);
  const published = data.content.filter(item => item.status === 'published').length;
  const resources = data.content.reduce((total, item) => total + (item.files?.length || 0), 0);
  const myLearning = useMemo(() => buildMyLearning(data.enrollments, data.content, data.progress, user.id), [data.enrollments, data.content, data.progress, user.id]);
  const visibleAssignableUsers = useMemo(() => data.assignableUsers.filter(person => {
    const text = `${person.name} ${person.email || ''} ${roleNames[person.user_type] || ''}`.toLowerCase();
    return text.includes(assignmentQuery.toLowerCase());
  }), [data.assignableUsers, assignmentQuery]);

  const createAssignment = async event => {
    event.preventDefault();
    if (!assignment.content_id) return toast.error('Selecciona una formación');
    if (!assignment.user_ids.length && !assignment.assign_to_all_representatives) return toast.error('Selecciona al menos una persona');
    setSaving(true);
    try {
      await api.post('/assignments', assignment);
      toast.success('Formación asignada');
      setAssignment(emptyAssignment);
      setAssignmentQuery('');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear la asignación');
    } finally {
      setSaving(false);
    }
  };

  const deleteAssignment = async item => {
    if (!window.confirm('¿Revocar esta asignación y sus inscripciones vinculadas?')) return;
    setSaving(true);
    try {
      await api.delete(`/assignments/${item.id}`);
      toast.success('Asignación revocada');
      await load();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo revocar la asignación');
    } finally {
      setSaving(false);
    }
  };

  const createSession = async event => {
    event.preventDefault();
    const startsAt = new Date(sessionForm.starts_at_local);
    const duration = Number(sessionForm.duration_minutes);
    const joinWindow = Number(sessionForm.join_window_minutes);
    const meetingUrl = sessionForm.meeting_url.trim();
    if (sessionForm.title.trim().length < 2) return toast.error('El título debe tener al menos 2 caracteres');
    if (Number.isNaN(startsAt.getTime()) || !Number.isFinite(duration) || duration < 5 || duration > 1440) {
      return toast.error('Revisa la fecha de inicio y la duración');
    }
    if (!Number.isInteger(joinWindow) || joinWindow < 0 || joinWindow > 180) return toast.error('La preventana debe estar entre 0 y 180 minutos');
    if (meetingUrl && !meetingUrl.startsWith('https://')) {
      return toast.error('El enlace de videollamada debe comenzar por https://');
    }

    setSaving(true);
    try {
      await api.post('/sessions', {
        content_id: sessionForm.content_id,
        title: sessionForm.title.trim(),
        starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + duration * 60_000).toISOString(),
        timezone: sessionForm.timezone,
        participant_user_ids: [],
        join_window_minutes: joinWindow,
        meeting_url: meetingUrl || null,
      });
      toast.success('Sesión programada');
      setSessionForm(createEmptySession());
      await loadSessions();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo programar la sesión');
    } finally {
      setSaving(false);
    }
  };

  const joinSession = session => {
    try {
      if (!submitPostInNewTab(`/sessions/${encodeURIComponent(session.id)}/join`)) {
        toast.error('El navegador ha bloqueado la nueva pestaña. Permite ventanas emergentes e inténtalo de nuevo.');
      }
    } catch (error) {
      toast.error(error.message || 'No se pudo abrir la sesión');
    }
  };

  const createFormation = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = { ...formation, duration_minutes: formation.duration_minutes ? Number(formation.duration_minutes) : null,
        trainer_names: formation.trainer_names.split(',').map(value => value.trim()).filter(Boolean),
        tags: formation.tags.split(',').map(value => value.trim()).filter(Boolean), files: formation.files.filter(file => file.url && file.title) };
      await api.post('/content', payload);
      toast.success(user.user_type === 'formador' ? 'Formación enviada para revisión' : 'Formación publicada');
      setFormation(emptyFormation); setTab('catalog'); await load();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear la formación'); }
    finally { setSaving(false); }
  };

  const createUser = async event => {
    event.preventDefault(); setSaving(true);
    try {
      await api.post('/users', { ...newUser, university_id: newUser.university_id || null });
      toast.success('Usuario creado'); setNewUser(emptyUser); await load();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear el usuario'); }
    finally { setSaving(false); }
  };

  const saveBoard = async () => {
    if (boardSlots.some(slot => !slot.user_id)) return toast.error('Asigna una persona a cada cargo visible');
    setSaving(true);
    try { await api.put('/board', { members: boardSlots }); toast.success('Junta Directiva actualizada'); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo actualizar la Junta'); }
    finally { setSaving(false); }
  };

  const createVocalia = async event => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/vocalias', vocalia); toast.success('Vocalía creada'); setVocalia(emptyVocalia); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear la Vocalía'); }
    finally { setSaving(false); }
  };

  const openMembers = item => {
    setSelectedVocalia(item);
    setMemberIds(data.users.filter(person => person.vocalia_ids?.includes(item.id)).map(person => person.id));
  };

  const saveMembers = async () => {
    setSaving(true);
    try { await api.put(`/vocalias/${selectedVocalia.id}/members`, { user_ids: memberIds }); toast.success('Miembros actualizados'); setSelectedVocalia(null); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudieron actualizar los miembros'); }
    finally { setSaving(false); }
  };

  const importSheet = async () => {
    setSaving(true);
    try {
      const { data: preview } = await api.post('/content/import-sheet', { spreadsheet_id: SHEET_ID, publish: true, dry_run: true });
      const confirmed = window.confirm(`Vista previa: ${preview.created} nuevas, ${preview.updated} actualizadas y ${preview.unchanged || 0} sin cambios. ¿Aplicar la importación?`);
      if (!confirmed) return;
      const { data: result } = await api.post('/content/import-sheet', { spreadsheet_id: SHEET_ID, publish: true, dry_run: false });
      toast.success(`${result.found} formaciones procesadas: ${result.created} nuevas y ${result.updated} actualizadas`); await load();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo importar la hoja'); }
    finally { setSaving(false); }
  };

  const createUniversity = async event => {
    event.preventDefault(); setSaving(true);
    try { await api.post('/universities', { ...university, zone: university.zone || null }); toast.success('Universidad creada'); setUniversity(emptyUniversity); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear la universidad'); }
    finally { setSaving(false); }
  };

  const deleteUniversity = async item => {
    if (!window.confirm(`¿Eliminar ${item.name}?`)) return;
    try { await api.delete(`/universities/${item.id}`); toast.success('Universidad eliminada'); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo eliminar la universidad'); }
  };

  const toggleUniversity = async item => {
    try { await api.put(`/universities/${item.id}/status`, { is_active: !item.is_active }); toast.success(`Universidad ${item.is_active ? 'desactivada' : 'activada'}`); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado'); }
  };

  const syncUniversities = async () => {
    setSaving(true);
    try {
      const { data: result } = await api.post('/universities/import-ritsi');
      toast.success(`${result.found} universidades procesadas: ${result.created} nuevas y ${result.updated} actualizadas`);
      await load();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo sincronizar el listado'); }
    finally { setSaving(false); }
  };

  const openPasswordReset = person => {
    setResetTarget(person);
    setPasswordResetUrl('');
  };

  const closePasswordReset = () => {
    setResetTarget(null);
    setPasswordResetUrl('');
  };

  const resetPassword = async () => {
    if (!resetTarget) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/users/${resetTarget.id}/password-reset-link`);
      setPasswordResetUrl(data.reset_url);
      await navigator.clipboard?.writeText(data.reset_url);
      toast.success('Enlace de recuperación generado y copiado');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const toggleUser = async person => {
    try { await api.put(`/users/${person.id}`, { is_active: !person.is_active }); toast.success('Estado actualizado'); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado'); }
  };

  const tabs = [
    { id: 'my-learning', label: 'Mi formación', icon: ClipboardList },
    { id: 'sessions', label: 'Sesiones', icon: Video },
    { id: 'notifications', label: `Notificaciones${unreadNotifications ? ` (${unreadNotifications})` : ''}`, icon: Bell },
    { id: 'achievements', label: 'Itinerarios y logros', icon: Award },
    { id: 'catalog', label: 'Catálogo', icon: BookOpen },
    { id: 'vocalias', label: 'Vocalías', icon: LayoutGrid },
    ...(canAssign ? [{ id: 'assignments', label: 'Asignaciones', icon: UserPlus }] : []),
    ...(canAuthor ? [{ id: 'create', label: 'Nueva formación', icon: FilePlus2 }] : []),
    ...(canAuthor ? [{ id: 'editorial', label: 'Mis contenidos', icon: BookOpen }] : []),
    ...((isAdmin || isBoard || user.user_type === 'universidad' || user.user_type === 'formador') ? [{ id: 'reports', label: 'Informes', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ id: 'board', label: 'Junta Directiva', icon: ShieldCheck }, { id: 'users', label: 'Usuarios', icon: Users }, { id: 'universities', label: 'Universidades', icon: Building2 }, { id: 'source', label: 'Fuente de datos', icon: Download }] : []),
  ];

  return (
    <DashboardLayout user={user} onLogout={onLogout} tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {loading ? <div className="panel empty-state"><span className="loader" /><p>Preparando tu espacio…</p></div> : <>
        {loadErrors.length > 0 && <div className="inline-alert warning dashboard-load-warning" role="alert"><AlertCircle aria-hidden="true" /><div><strong>Algunos datos no se han podido actualizar</strong><p>{loadErrors.map(error => error.area).join(', ')}. Puedes seguir usando las secciones disponibles.</p></div><button type="button" className="secondary-button" onClick={load}>Reintentar</button></div>}

        {tab === 'my-learning' && <MyLearningSection items={myLearning} onOpen={item => navigate(`/content/${item.content.id}`)} />}

        {tab === 'notifications' && <NotificationSettings user={user} onUnreadChange={setUnreadNotifications} />}

        {tab === 'achievements' && <LearningAchievements canCreate={isAdmin || isBoard} canAssign={canAssign} content={data.content} users={data.assignableUsers} />}

        {tab === 'reports' && <ReportsOverview />}

        {tab === 'editorial' && canAuthor && <EditorialManager user={user} content={data.content} onRefresh={load} />}

        {tab === 'sessions' && <SessionsSection
          sessions={sessions}
          content={data.content}
          currentUser={user}
          canCreate={canCreateSessions}
          form={sessionForm}
          setForm={setSessionForm}
          loading={sessionsLoading}
          error={sessionsError}
          saving={saving}
          onRetry={loadSessions}
          onSubmit={createSession}
          onJoin={joinSession}
        />}

        {tab === 'assignments' && canAssign && <AssignmentsSection
          assignments={data.assignments}
          assignment={assignment}
          setAssignment={setAssignment}
          content={data.content}
          users={visibleAssignableUsers}
          userQuery={assignmentQuery}
          setUserQuery={setAssignmentQuery}
          allowGlobal={isAdmin || isBoard}
          saving={saving}
          onSubmit={createAssignment}
          onDelete={deleteAssignment}
        />}

        {tab === 'catalog' && <section>
          <div className="page-heading"><div><span className="eyebrow">Biblioteca formativa</span><h1>Todo el conocimiento, en un solo lugar</h1><p>Explora el catálogo y abre los recursos originales asociados a cada formación.</p></div></div>
          <div className="stat-grid"><Stat icon={BookOpen} value={published} label="Formaciones publicadas" /><Stat icon={ExternalLink} value={resources} label="Recursos disponibles" /><Stat icon={CalendarDays} value={years.length} label="Cursos académicos" /></div>
          <div className="catalog-toolbar"><label className="search-box"><Search size={18} aria-hidden="true" /><input aria-label="Buscar formaciones" placeholder="Buscar por título, etiqueta o persona…" value={query} onChange={event => setQuery(event.target.value)} /></label><label className="filter-label"><span className="sr-only">Filtrar por curso académico</span><select value={year} onChange={event => setYear(event.target.value)}><option value="all">Todos los cursos</option>{years.map(item => <option key={item}>{item}</option>)}</select></label></div>
          <div className="content-grid">{filtered.map(item => <TrainingCard key={item.id} item={item} onClick={() => navigate(`/content/${item.id}`)} canApprove={(isAdmin || isBoard) && item.status === 'pending'} onApprove={async () => { await api.post(`/content/${item.id}/approve`); toast.success('Formación publicada'); load(); }} onRequestChanges={async () => { const note = window.prompt('Indica los cambios solicitados'); if (!note) return; await api.post(`/content/${item.id}/review`, { action: 'request_changes', note }); toast.success('Cambios solicitados'); load(); }} />)}</div>
          {!filtered.length && <div className="panel empty-state"><Search /><h3>No hay resultados</h3><p>Prueba con otra búsqueda o curso académico.</p></div>}
        </section>}

        {tab === 'vocalias' && <section>
          <div className="page-heading"><div><span className="eyebrow">Organización</span><h1>Vocalías</h1><p>Cada Vocalía está acompañada por una persona de Junta Directiva y reúne a su equipo.</p></div></div>
          {isAdmin && <form className="panel compact-form" onSubmit={createVocalia}><div><h2>Crear Vocalía</h2><p>Define su propósito y la persona responsable.</p></div><label>Nombre<input required value={vocalia.name} onChange={e => setVocalia({ ...vocalia, name: e.target.value })} /></label><label>Responsable de Junta<select required value={vocalia.board_member_id} onChange={e => setVocalia({ ...vocalia, board_member_id: e.target.value })}><option value="">Seleccionar</option>{data.board.map(item => <option key={item.id} value={item.id}>{item.name} · {boardPositionNames[item.board_position]}</option>)}</select></label><label className="wide">Descripción<textarea value={vocalia.description} onChange={e => setVocalia({ ...vocalia, description: e.target.value })} /></label><button className="primary-button" disabled={saving}><Plus size={16} /> Crear Vocalía</button></form>}
          <div className="vocalia-grid">{data.vocalias.map(item => { const owner = data.board.find(person => person.id === item.board_member_id); const members = data.users.filter(person => person.vocalia_ids?.includes(item.id)); const canManage = isAdmin || (isBoard && item.board_member_id === user.id); return <article className="panel vocalia-card" key={item.id}><div className="vocalia-monogram">{item.name.slice(0, 2).toUpperCase()}</div><h2>{item.name}</h2><p>{item.description || 'Sin descripción añadida.'}</p><div className="owner"><ShieldCheck size={17} /><span><small>Responsable</small>{owner?.name || 'Persona de Junta'}</span></div><div className="member-row"><span>{members.length} miembros</span>{canManage && <button className="text-button" onClick={() => openMembers(item)}>Gestionar</button>}</div></article>; })}</div>
          {!data.vocalias.length && <div className="panel empty-state"><LayoutGrid /><h3>Aún no hay Vocalías</h3><p>Administración puede crear la primera desde esta pantalla.</p></div>}
        </section>}

        {tab === 'create' && <section><div className="page-heading"><div><span className="eyebrow">Autoría</span><h1>Nueva formación</h1><p>Añade metadatos claros y enlaza los materiales que utilizará el alumnado.</p></div></div><form className="panel editor-form" onSubmit={createFormation}><label className="wide">Título<input required value={formation.title} onChange={e => setFormation({ ...formation, title: e.target.value })} /></label><label className="wide">Descripción<textarea rows="4" value={formation.description} onChange={e => setFormation({ ...formation, description: e.target.value })} /></label><label>Fecha<input type="date" value={formation.training_date} onChange={e => setFormation({ ...formation, training_date: e.target.value })} /></label><label>Duración en minutos<input type="number" min="1" value={formation.duration_minutes} onChange={e => setFormation({ ...formation, duration_minutes: e.target.value })} /></label><label className="wide">Dirigida a<input value={formation.audience} onChange={e => setFormation({ ...formation, audience: e.target.value })} /></label><label>Personas formadoras<input placeholder="Separadas por comas" value={formation.trainer_names} onChange={e => setFormation({ ...formation, trainer_names: e.target.value })} /></label><label>Etiquetas<input placeholder="Separadas por comas" value={formation.tags} onChange={e => setFormation({ ...formation, tags: e.target.value })} /></label><div className="wide resource-editor"><div className="section-title"><div><h2>Recursos enlazados</h2><p>Añade presentaciones, documentos, vídeos u otros materiales.</p></div><button type="button" className="secondary-button" onClick={() => setFormation({ ...formation, files: [...formation.files, { title: '', url: '', file_type: 'link' }] })}><Plus size={16} aria-hidden="true" /> Recurso</button></div>{formation.files.map((file, index) => <div className="resource-row" key={index}><input aria-label={`Título del recurso ${index + 1}`} placeholder="Título" value={file.title} onChange={e => { const files = [...formation.files]; files[index] = { ...file, title: e.target.value }; setFormation({ ...formation, files }); }} /><input aria-label={`URL del recurso ${index + 1}`} type="url" placeholder="https://…" value={file.url} onChange={e => { const files = [...formation.files]; files[index] = { ...file, url: e.target.value }; setFormation({ ...formation, files }); }} /><select aria-label={`Tipo del recurso ${index + 1}`} value={file.file_type} onChange={e => { const files = [...formation.files]; files[index] = { ...file, file_type: e.target.value }; setFormation({ ...formation, files }); }}><option value="presentation">Presentación</option><option value="document">Documento</option><option value="pdf">PDF</option><option value="video">Vídeo</option><option value="image">Imagen</option><option value="link">Enlace</option></select>{formation.files.length > 1 && <button type="button" className="icon-button" aria-label={`Eliminar recurso ${index + 1}`} onClick={() => setFormation({ ...formation, files: formation.files.filter((_, i) => i !== index) })}><X size={17} aria-hidden="true" /></button>}</div>)}</div><QuizEditor value={formation.quizzes} onChange={quizzes => setFormation({ ...formation, quizzes })} /><label className="check-label"><input type="checkbox" checked={formation.is_public} onChange={e => setFormation({ ...formation, is_public: e.target.checked })} /> Disponible públicamente para personas registradas</label><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar formación'}</button></form></section>}

        {tab === 'board' && <section><div className="page-heading"><div><span className="eyebrow">Gobernanza</span><h1>Junta Directiva</h1><p>Los cinco cargos esenciales son obligatorios. Puedes añadir hasta dos miembros adicionales.</p></div></div><div className="panel board-editor">{boardSlots.map((slot, index) => <div className="board-slot" key={slot.position}><div><strong>{boardPositionNames[slot.position]}</strong><small>{index < 5 ? 'Cargo obligatorio' : 'Plaza adicional'}</small></div><select aria-label={`Persona para ${boardPositionNames[slot.position]}`} value={slot.user_id} onChange={e => setBoardSlots(boardSlots.map(item => item.position === slot.position ? { ...item, user_id: e.target.value } : item))}><option value="">Seleccionar persona</option>{data.users.filter(person => person.is_active && person.user_type !== 'admin').map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select>{index >= 5 && <button type="button" className="icon-button" aria-label={`Eliminar ${boardPositionNames[slot.position]}`} onClick={() => setBoardSlots(boardSlots.filter(item => item.position !== slot.position))}><X size={17} aria-hidden="true" /></button>}</div>)}<div className="board-actions">{boardSlots.length < 7 && <button type="button" className="secondary-button" onClick={() => { const next = positions.find(position => !boardSlots.some(slot => slot.position === position)); setBoardSlots([...boardSlots, { position: next, user_id: '' }]); }}><Plus size={16} aria-hidden="true" /> Añadir miembro</button>}<button type="button" className="primary-button" disabled={saving} onClick={saveBoard}>Guardar composición</button></div></div></section>}

        {tab === 'users' && <section>
          <div className="page-heading"><div><span className="eyebrow">Administración</span><h1>Usuarios</h1><p>Crea cuentas, renueva sus credenciales y consulta su pertenencia.</p></div></div>
          <form className="panel compact-form" onSubmit={createUser}>
            <label>Nombre<input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} /></label>
            <label>Correo<input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></label>
            <label>Contraseña temporal<input required minLength="8" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></label>
            <label>Perfil<select value={newUser.user_type} onChange={e => setNewUser({ ...newUser, user_type: e.target.value })}><option value="representante">Representante</option><option value="universidad">Universidad</option><option value="formador">Persona formadora</option><option value="colaboracion_externa">Colaboración externa</option><option value="admin">Administración</option></select></label>
            <label>Universidad<select value={newUser.university_id} onChange={e => setNewUser({ ...newUser, university_id: e.target.value })}><option value="">No aplicable</option>{data.universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <button className="primary-button" disabled={saving}><Plus size={16} aria-hidden="true" /> Crear usuario</button>
          </form>
          <div className="panel table-wrap"><table><thead><tr><th>Persona</th><th>Perfil</th><th>Vocalías</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.users.map(person => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.board_position ? boardPositionNames[person.board_position] : roleNames[person.user_type]}</td><td>{person.vocalia_ids?.length || 0}</td><td><span className={`status ${person.is_active ? 'success' : ''}`}>{person.is_active ? 'Activo' : 'Inactivo'}</span></td><td><div className="table-actions"><button type="button" className="text-button" onClick={() => openPasswordReset(person)}>Nueva clave</button>{person.id !== user.id && <button type="button" className="text-button" onClick={() => toggleUser(person)}>{person.is_active ? 'Desactivar' : 'Activar'}</button>}</div></td></tr>)}</tbody></table></div>
        </section>}

        {tab === 'universities' && <section><div className="page-heading"><div><span className="eyebrow">Estructura territorial</span><h1>Universidades</h1><p>Las universidades activas son socias de RITSI; las inactivas se consideran no socias y no aparecen en el formulario de registro.</p></div><button className="secondary-button" onClick={syncUniversities} disabled={saving}><Download size={16} /> {saving ? 'Sincronizando…' : 'Sincronizar desde RITSI'}</button></div><form className="panel compact-form" onSubmit={createUniversity}><label>Nombre de la universidad<input required value={university.name} onChange={e => setUniversity({ ...university, name: e.target.value })} /></label><label>Zona<select value={university.zone} onChange={e => setUniversity({ ...university, zone: e.target.value })}><option value="">Sin zona</option>{['I','II','III','IV','V'].map(zone => <option key={zone} value={zone}>Zona {zone}</option>)}</select></label><button className="primary-button" disabled={saving}><Plus size={16} /> Crear universidad socia</button></form><div className="panel table-wrap"><table><thead><tr><th>Universidad</th><th>Región</th><th>Zona</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.universities.map(item => <tr key={item.id}><td><strong>{item.name}</strong>{item.center_name && <small>{item.center_name}</small>}</td><td>{item.region || '—'}</td><td>{item.zone ? `Zona ${item.zone}` : 'Sin zona'}</td><td><span className={`status ${item.is_active ? 'success' : ''}`}>{item.is_active ? 'Socia · activa' : 'No socia · inactiva'}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => toggleUniversity(item)}>{item.is_active ? 'Marcar no socia' : 'Marcar socia'}</button><button className="text-button" onClick={() => deleteUniversity(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div></section>}

        {tab === 'source' && <section><div className="page-heading"><div><span className="eyebrow">Sincronización</span><h1>Fuente de datos</h1><p>Actualiza el catálogo desde el registro oficial manteniendo todos los enlaces disponibles.</p></div></div><div className="panel source-card"><div className="source-icon"><Download /></div><div><h2>Registro de Formaciones</h2><p>La importación es idempotente: crea nuevas entradas y actualiza las ya existentes sin duplicarlas.</p><a href={sheetUrl} target="_blank" rel="noreferrer">Abrir hoja original <ExternalLink size={14} /></a></div><button className="primary-button" onClick={importSheet} disabled={saving}>{saving ? 'Sincronizando…' : 'Sincronizar ahora'}</button></div><IntegrationOperations /></section>}
      </>}

      {selectedVocalia && <AccessibleModal
        title={selectedVocalia.name}
        eyebrow="Equipo"
        onClose={() => setSelectedVocalia(null)}
        actions={<><button type="button" className="secondary-button" onClick={() => setSelectedVocalia(null)}>Cancelar</button><button type="button" className="primary-button" disabled={saving} onClick={saveMembers}>Guardar miembros</button></>}
      >
        <div className="member-picker">{data.users.filter(person => person.is_active).map(person => <label key={person.id}><input type="checkbox" checked={memberIds.includes(person.id)} onChange={e => setMemberIds(e.target.checked ? [...memberIds, person.id] : memberIds.filter(id => id !== person.id))} /><span><strong>{person.name}</strong><small>{roleNames[person.user_type]}</small></span></label>)}</div>
      </AccessibleModal>}

      {resetTarget && <AccessibleModal title={`Nueva clave para ${resetTarget.name}`} eyebrow="Seguridad" onClose={closePasswordReset}>
        <div className="password-reset-form">
          <p>Genera un enlace de un solo uso, válido durante 30 minutos. Compártelo por un canal seguro; la plataforma no mostrará una contraseña temporal.</p>
          {passwordResetUrl && <label>Enlace de recuperación<input autoFocus readOnly value={passwordResetUrl} onFocus={event => event.target.select()} /></label>}
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={closePasswordReset}>Cerrar</button><button type="button" className="primary-button" disabled={saving} onClick={resetPassword}>{saving ? 'Generando…' : passwordResetUrl ? 'Rotar enlace' : 'Generar enlace'}</button></div>
        </div>
      </AccessibleModal>}
    </DashboardLayout>
  );
}

function Stat({ icon: Icon, value, label }) { return <article className="stat-card"><Icon /><div><strong>{value}</strong><span>{label}</span></div></article>; }

function buildMyLearning(enrollments, content, progress, userId) {
  const ownProgress = progress.filter(item => !item.user_id || item.user_id === userId);
  const progressByContent = new Map(ownProgress.map(item => [item.content_id, item]));
  const source = enrollments.length ? enrollments : ownProgress.map(item => ({ id: `progress-${item.content_id}`, content_id: item.content_id, status: item.completed ? 'completed' : 'in_progress' }));
  const unique = new Map();

  source.forEach(enrollment => {
    const item = enrollment.content || content.find(candidate => candidate.id === enrollment.content_id);
    if (!item) return;
    const itemProgress = enrollment.progress || progressByContent.get(item.id) || {};
    const completedFiles = itemProgress.files_completed?.length || 0;
    const totalFiles = item.files?.length || 0;
    let status = enrollment.status || (itemProgress.completed ? 'completed' : 'assigned');
    if (status === 'assigned' && completedFiles > 0) status = 'in_progress';
    const percentage = itemProgress.completed || status === 'completed' ? 100 : totalFiles ? Math.round((completedFiles / totalFiles) * 100) : 0;
    const candidate = { ...enrollment, content: item, status, completedFiles, totalFiles, percentage };
    const current = unique.get(item.id);
    if (!current || candidate.percentage >= current.percentage) unique.set(item.id, candidate);
  });

  return [...unique.values()];
}

const learningStatus = {
  assigned: { label: 'Asignada', className: '' },
  active: { label: 'Asignada', className: '' },
  in_progress: { label: 'En curso', className: 'progress' },
  completed: { label: 'Completada', className: 'success' },
  cancelled: { label: 'Cancelada', className: 'danger' },
};

function MyLearningSection({ items, onOpen }) {
  const completed = items.filter(item => item.status === 'completed').length;
  const inProgress = items.filter(item => item.status === 'in_progress').length;
  return <section>
    <div className="page-heading"><div><span className="eyebrow">Tu espacio de aprendizaje</span><h1>Mi formación</h1><p>Continúa las formaciones que tienes asignadas y consulta el avance guardado.</p></div></div>
    <div className="stat-grid"><Stat icon={ClipboardList} value={items.length} label="Formaciones asignadas" /><Stat icon={BookOpen} value={inProgress} label="En curso" /><Stat icon={CheckCircle2} value={completed} label="Completadas" /></div>
    {items.length ? <div className="content-grid">{items.map(item => <TrainingCard key={item.id || item.content.id} item={item.content} onClick={() => onOpen(item)} learning={item} />)}</div> : <div className="panel empty-state"><ClipboardList aria-hidden="true" /><h3>Aún no tienes formación asignada</h3><p>Cuando recibas una asignación aparecerá aquí. Mientras tanto puedes explorar el catálogo.</p></div>}
  </section>;
}

const sessionStatus = {
  draft: { label: 'Borrador', className: '' },
  scheduled: { label: 'Programada', className: 'progress' },
  live: { label: 'En directo', className: 'success' },
  ended: { label: 'Finalizada', className: '' },
  cancelled: { label: 'Cancelada', className: 'danger' },
};

function sessionDate(value, timeZone, options = {}) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('es-ES', { timeZone, ...options }).format(new Date(value));
  } catch {
    return new Intl.DateTimeFormat('es-ES', options).format(new Date(value));
  }
}

function SessionsSection({ sessions, content, currentUser, canCreate, form, setForm, loading, error, saving, onRetry, onSubmit, onJoin }) {
  const [attendanceSession, setAttendanceSession] = useState(null);
  const [managedSession, setManagedSession] = useState(null);
  const manageableContent = currentUser.user_type === 'formador'
    ? content.filter(item => item.created_by === currentUser.id)
    : content;
  const startPreview = form.starts_at_local ? new Date(form.starts_at_local) : null;
  const endPreview = startPreview && !Number.isNaN(startPreview.getTime())
    ? new Date(startPreview.getTime() + Number(form.duration_minutes || 0) * 60_000)
    : null;
  const orderedSessions = [...sessions].sort((left, right) => {
    const leftTerminal = ['ended', 'cancelled'].includes(left.status);
    const rightTerminal = ['ended', 'cancelled'].includes(right.status);
    if (leftTerminal !== rightTerminal) return leftTerminal ? 1 : -1;
    return leftTerminal
      ? new Date(right.starts_at) - new Date(left.starts_at)
      : new Date(left.starts_at) - new Date(right.starts_at);
  });

  return <section>
    <div className="page-heading"><div><span className="eyebrow">Encuentros en directo</span><h1>Sesiones</h1><p>Consulta tus próximas sesiones y accede cuando se abra la ventana configurada.</p></div><button type="button" className="secondary-button" onClick={onRetry} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button></div>

    {attendanceSession && <AttendanceManager session={attendanceSession} onClose={() => setAttendanceSession(null)} />}
    {managedSession && <SessionEditor session={managedSession} onClose={() => setManagedSession(null)} onSaved={onRetry} />}

    {canCreate && <form className="panel session-form" onSubmit={onSubmit}>
      <div className="session-form-heading"><div><h2>Programar una sesión</h2><p>La plataforma protegerá el enlace y solo lo entregará durante la ventana de acceso.</p></div><span className="timezone-chip"><Globe2 size={15} aria-hidden="true" /> {form.timezone}</span></div>
      <label className="wide">Formación<select required value={form.content_id} onChange={event => setForm(current => ({ ...current, content_id: event.target.value }))}><option value="">Seleccionar formación</option>{manageableContent.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="wide">Título de la sesión<input required minLength="2" maxLength="240" value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="Por ejemplo, taller práctico" /></label>
      <label>Inicio en tu hora local<input required type="datetime-local" value={form.starts_at_local} onChange={event => setForm(current => ({ ...current, starts_at_local: event.target.value }))} /></label>
      <label>Duración en minutos<input required type="number" min="5" max="1440" step="5" value={form.duration_minutes} onChange={event => setForm(current => ({ ...current, duration_minutes: event.target.value }))} /></label>
      <label>Zona horaria detectada<input readOnly value={form.timezone} /></label>
      <label>Acceso previo en minutos<input required type="number" min="0" max="180" value={form.join_window_minutes} onChange={event => setForm(current => ({ ...current, join_window_minutes: event.target.value }))} /></label>
      <label className="wide">Enlace de videollamada, opcional<input type="url" pattern="https://.*" placeholder="https://meet.google.com/…" value={form.meeting_url} onChange={event => setForm(current => ({ ...current, meeting_url: event.target.value }))} /><small>El enlace no aparecerá en listados ni respuestas normales de la API.</small></label>
      {endPreview && <output className="wide session-end-preview" aria-live="polite"><Clock3 size={17} aria-hidden="true" /><span>Final previsto: <strong>{sessionDate(endPreview, form.timezone, { dateStyle: 'medium', timeStyle: 'short' })}</strong></span></output>}
      {!manageableContent.length && <p className="wide form-help warning-text">No tienes formaciones disponibles para programar una sesión.</p>}
      <button className="primary-button session-submit" disabled={saving || !manageableContent.length}>{saving ? 'Programando…' : 'Programar sesión'}</button>
    </form>}

    {loading ? <div className="panel empty-state" role="status"><span className="loader" /><p>Cargando sesiones…</p></div> : error ? <div className="inline-alert warning" role="alert"><AlertCircle aria-hidden="true" /><div><strong>No se pudieron cargar las sesiones</strong><p>{error}</p></div><button type="button" className="secondary-button" onClick={onRetry}>Reintentar</button></div> : orderedSessions.length ? <div className="session-list">{orderedSessions.map(session => {
      const state = sessionStatus[session.status] || { label: session.status, className: '' };
      const training = content.find(item => item.id === session.content_id);
      const headingId = `session-${session.id}`;
      return <article className="panel session-card" key={session.id} aria-labelledby={headingId}>
        <div className="session-card-top"><span className={`status ${state.className}`}>{state.label}</span><span className="session-training">{training?.title || 'Formación asociada'}</span></div>
        <h2 id={headingId}>{session.title}</h2>
        {session.description && <p>{session.description}</p>}
        <div className="session-meta"><span><CalendarDays aria-hidden="true" /><strong>{sessionDate(session.starts_at, session.timezone, { dateStyle: 'medium', timeStyle: 'short' })}</strong></span><span><Clock3 aria-hidden="true" /> Hasta {sessionDate(session.ends_at, session.timezone, { timeStyle: 'short' })}</span><span><Globe2 aria-hidden="true" /> {session.timezone}</span></div>
        <div className="session-card-footer"><div>{session.can_join ? <span className="join-ready"><CheckCircle2 aria-hidden="true" /> Acceso disponible ahora</span> : <><strong>Acceso no disponible</strong><small>{session.join_unavailable_reason || 'La sesión todavía no admite acceso.'}</small>{session.join_available_from && session.status === 'scheduled' && <small>Disponible desde {sessionDate(session.join_available_from, session.timezone, { dateStyle: 'medium', timeStyle: 'short' })}</small>}</>}</div><div className="session-actions">{session.can_manage && <><button type="button" className="secondary-button" onClick={() => setManagedSession(session)}>Gestionar</button><button type="button" className="secondary-button" onClick={() => setAttendanceSession(session)}>Asistencia</button></>}{session.can_join && <button type="button" className="primary-button" onClick={() => onJoin(session)}>Acceder <ExternalLink size={16} aria-hidden="true" /></button>}</div></div>
      </article>;
    })}</div> : <div className="panel empty-state"><Video aria-hidden="true" /><h3>No hay sesiones programadas</h3><p>Las sesiones disponibles para tu formación aparecerán aquí.</p></div>}
  </section>;
}

function AssignmentsSection({ assignments, assignment, setAssignment, content, users, userQuery, setUserQuery, allowGlobal, saving, onSubmit, onDelete }) {
  const publishedContent = content.filter(item => item.status === 'published');
  const toggleUser = userId => setAssignment(current => ({ ...current, user_ids: current.user_ids.includes(userId) ? current.user_ids.filter(id => id !== userId) : [...current.user_ids, userId] }));
  return <section>
    <div className="page-heading"><div><span className="eyebrow">Inscripciones</span><h1>Asignaciones</h1><p>Selecciona una formación publicada y las personas que deben encontrarla en “Mi formación”.</p></div></div>
    <form className="panel assignment-form" onSubmit={onSubmit}>
      <div className="assignment-form-heading"><div><h2>Nueva asignación</h2><p>Solo se muestran destinatarios dentro de tu ámbito de gestión.</p></div><span className="selection-count" aria-live="polite">{assignment.user_ids.length} seleccionadas</span></div>
      <label className="wide">Formación publicada<select required value={assignment.content_id} onChange={event => setAssignment(current => ({ ...current, content_id: event.target.value }))}><option value="">Seleccionar formación</option>{publishedContent.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="wide search-box assignment-search"><span className="sr-only">Buscar personas destinatarias</span><Search size={18} aria-hidden="true" /><input type="search" placeholder="Buscar por nombre, correo o perfil…" value={userQuery} onChange={event => setUserQuery(event.target.value)} /></label>
      <fieldset className="wide assignment-user-picker"><legend>Personas destinatarias</legend>{users.length ? users.map(person => <label key={person.id}><input type="checkbox" checked={assignment.user_ids.includes(person.id)} onChange={() => toggleUser(person.id)} /><span><strong>{person.name}</strong><small>{person.email} · {roleNames[person.user_type] || person.user_type}</small></span></label>) : <p>No hay personas disponibles con este filtro o dentro de tu ámbito.</p>}</fieldset>
      {allowGlobal && <label className="check-label"><input type="checkbox" checked={assignment.assign_to_all_representatives} onChange={event => setAssignment(current => ({ ...current, assign_to_all_representatives: event.target.checked }))} /> Asignar también a todas las personas representantes</label>}
      <button className="primary-button assignment-submit" disabled={saving || !publishedContent.length}>{saving ? 'Asignando…' : 'Crear asignación'}</button>
    </form>

    <div className="section-title assignment-history-title"><div><h2>Asignaciones vigentes</h2><p>Las revocaciones eliminan también las inscripciones creadas por esa operación.</p></div></div>
    {assignments.length ? <div className="panel table-wrap"><table><thead><tr><th>Formación</th><th>Alcance</th><th>Creada</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{assignments.map(item => {
      const training = content.find(candidate => candidate.id === item.content_id);
      const count = (item.assigned_to_user_ids || item.user_ids || []).length;
      return <tr key={item.id}><td><strong>{training?.title || 'Formación no disponible'}</strong><small>{item.content_id}</small></td><td>{item.assigned_to_all_representatives ? `Representantes y ${count} selecciones directas` : `${count} ${count === 1 ? 'persona' : 'personas'}`}</td><td>{item.created_at ? new Date(item.created_at).toLocaleDateString('es-ES') : '—'}</td><td><span className="status success">Vigente</span></td><td><button type="button" className="icon-button danger-button" aria-label={`Revocar asignación de ${training?.title || 'formación'}`} onClick={() => onDelete(item)} disabled={saving}><Trash2 size={17} aria-hidden="true" /></button></td></tr>;
    })}</tbody></table></div> : <div className="panel empty-state compact-empty"><UserPlus aria-hidden="true" /><h3>No hay asignaciones visibles</h3><p>Crea la primera desde el formulario superior.</p></div>}
  </section>;
}

function TrainingCard({ item, onClick, canApprove, onApprove, onRequestChanges, learning }) {
  const state = learningStatus[learning?.status] || learningStatus.assigned;
  return <article className="training-card">
    <div className="card-top"><span className="course-chip">{item.academic_year || 'Formación'}</span>{learning ? <span className={`status ${state.className}`}>{state.label}</span> : item.rating ? <span className="rating"><Sparkles size={13} aria-hidden="true" /> {item.rating.toFixed(1)}</span> : null}</div>
    <h2>{item.title}</h2>
    <p>{item.description || 'Consulta los materiales y detalles de esta formación.'}</p>
    <div className="tag-row">{item.tags?.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
    <div className="card-meta">{item.training_date && <span><CalendarDays size={15} aria-hidden="true" /> {new Date(`${item.training_date}T00:00:00`).toLocaleDateString('es-ES')}</span>}{item.duration_minutes && <span>{item.duration_minutes} min</span>}</div>
    {learning && <div className="learning-progress"><div><span>Progreso</span><strong>{learning.percentage}%</strong></div><div className="progress-track" role="progressbar" aria-label={`Progreso de ${item.title}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={learning.percentage}><span style={{ width: `${learning.percentage}%` }} /></div><small>{learning.completedFiles}/{learning.totalFiles} recursos consultados</small></div>}
    <div className="card-footer"><span>{item.files?.length || 0} recursos</span><div className="card-actions"><button type="button" className="text-button" onClick={onClick}>Abrir <ExternalLink size={14} aria-hidden="true" /></button>{canApprove && <><button type="button" className="text-button" onClick={onRequestChanges}>Pedir cambios</button><button type="button" className="text-button" onClick={onApprove}>Publicar</button></>}</div></div>
  </article>;
}
