import { useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, CalendarDays, CheckCircle2, Clock3, Link2, MessageCircle, Plus, RefreshCw, Trash2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import QuizEditor from './QuizEditor';

const notificationTypeLabels = {
  TrainingAssigned: 'Asignada', TrainingStarted: 'En proceso', TrainingCompleted: 'Finalizada',
  SessionScheduled: 'Sesión', SessionRescheduled: 'Reprogramada', SessionCancelled: 'Cancelada',
  SessionParticipantsUpdated: 'Convocatoria',
};

export function NotificationSettings({ user, onUnreadChange }) {
  const [notifications, setNotifications] = useState([]);
  const [preferences, setPreferences] = useState(null);
  const [telegram, setTelegram] = useState({ configured: false, linked: false });
  const [calendarUrl, setCalendarUrl] = useState('');
  const [profileName, setProfileName] = useState(user.name);
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' });
  const [deletionPassword, setDeletionPassword] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(item => !item.read_at).length;
  const visibleNotifications = useMemo(() => notifications.filter(item => {
    if (notificationFilter === 'unread') return !item.read_at;
    if (notificationFilter === 'training') return item.type?.startsWith('Training');
    if (notificationFilter === 'sessions') return item.type?.startsWith('Session');
    return true;
  }), [notifications, notificationFilter]);

  useEffect(() => { onUnreadChange?.(unreadCount); }, [onUnreadChange, unreadCount]);

  const load = async () => {
    setLoading(true);
    const [notificationResult, preferenceResult, telegramResult] = await Promise.allSettled([
      api.get('/notifications'), api.get('/notification-preferences'), api.get('/integrations/telegram'),
    ]);
    if (notificationResult.status === 'fulfilled') setNotifications(notificationResult.value.data);
    if (preferenceResult.status === 'fulfilled') setPreferences(preferenceResult.value.data);
    if (telegramResult.status === 'fulfilled') setTelegram(telegramResult.value.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const savePreferences = async next => {
    setPreferences(next);
    try { await api.put('/notification-preferences', next); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudieron guardar las preferencias'); load(); }
  };

  const linkTelegram = async () => {
    try {
      const { data } = await api.post('/integrations/telegram/link');
      window.open(data.url, '_blank', 'noopener,noreferrer');
      toast.info('Completa la vinculación en Telegram. El enlace caduca en 10 minutos.');
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo iniciar la vinculación'); }
  };

  const unlinkTelegram = async () => {
    await api.delete('/integrations/telegram');
    setTelegram(current => ({ ...current, linked: false }));
    toast.success('Telegram desvinculado');
  };

  const createCalendar = async () => {
    try {
      const { data } = await api.post('/integrations/calendar/feed');
      setCalendarUrl(data.url);
      await navigator.clipboard?.writeText(data.url);
      toast.success('Enlace de calendario creado y copiado');
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear el calendario'); }
  };

  const revokeCalendar = async () => {
    await api.delete('/integrations/calendar/feed'); setCalendarUrl(''); toast.success('Suscripción de calendario revocada');
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    setNotifications(items => items.map(item => ({ ...item, read_at: new Date().toISOString() })));
  };

  const markRead = async item => {
    if (item.read_at) return;
    const readAt = new Date().toISOString();
    setNotifications(items => items.map(current => current.id === item.id ? { ...current, read_at: readAt } : current));
    try { await api.post(`/notifications/${encodeURIComponent(item.id)}/read`); }
    catch { load(); }
  };

  const saveProfile = async event => {
    event.preventDefault();
    try {
      await api.patch('/profile', { name: profileName, picture: user.picture || null });
      toast.success('Perfil actualizado');
      window.location.reload();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo actualizar el perfil'); }
  };

  const changePassword = async event => {
    event.preventDefault();
    try { await api.post('/profile/change-password', passwordForm); window.location.assign('/'); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo cambiar la contraseña'); }
  };

  const exportData = async () => {
    try {
      const { data } = await api.get('/privacy/export');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      link.download = `datos-formacion-ritsi-${new Date().toISOString().slice(0, 10)}.json`;
      link.click(); URL.revokeObjectURL(link.href);
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo preparar la exportación'); }
  };

  const requestDeletion = async event => {
    event.preventDefault();
    if (!window.confirm('La cuenta se desactivará inmediatamente y la solicitud quedará pendiente de revisión. ¿Continuar?')) return;
    try { await api.post('/privacy/deletion-request', { password: deletionPassword }); window.location.assign('/'); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo registrar la solicitud'); }
  };

  return <section>
    <div className="page-heading"><div><span className="eyebrow">Comunicaciones</span><h1>Avisos e integraciones</h1><p>Controla tus recordatorios y conecta servicios sin compartir credenciales con la plataforma.</p></div><button className="secondary-button" onClick={load} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Actualizar</button></div>
    <div className="tool-grid">
      <form className="panel tool-card" onSubmit={saveProfile}><Bell aria-hidden="true" /><div><h2>Perfil</h2><p>Actualiza el nombre que se muestra en la plataforma.</p></div><label>Nombre<input required minLength="2" maxLength="120" value={profileName} onChange={event => setProfileName(event.target.value)} /></label><button className="primary-button">Guardar perfil</button></form>
      <article className="panel tool-card"><MessageCircle aria-hidden="true" /><div><h2>Telegram</h2><p>{telegram.linked ? 'Tu cuenta está vinculada.' : telegram.configured ? 'Recibe asignaciones y recordatorios.' : 'Integración pendiente de configuración institucional.'}</p></div>{telegram.linked ? <button className="secondary-button" onClick={unlinkTelegram}><Unlink size={16} /> Desvincular</button> : <button className="primary-button" disabled={!telegram.configured} onClick={linkTelegram}><Link2 size={16} /> Vincular</button>}</article>
      <article className="panel tool-card"><CalendarDays aria-hidden="true" /><div><h2>Calendario</h2><p>Crea un feed privado compatible con Google Calendar, Outlook y Apple Calendar. Puedes rotarlo cuando quieras.</p></div><div className="tool-actions"><button className="primary-button" onClick={createCalendar}>Crear o rotar enlace</button><button className="secondary-button" onClick={revokeCalendar}>Revocar</button></div>{calendarUrl && <input aria-label="URL privada del calendario" readOnly value={calendarUrl} onFocus={event => event.target.select()} />}</article>
    </div>
    <div className="account-grid"><form className="panel account-panel" onSubmit={changePassword}><h2>Cambiar contraseña</h2><label>Contraseña actual<input required minLength="8" type="password" autoComplete="current-password" value={passwordForm.current_password} onChange={event => setPasswordForm({ ...passwordForm, current_password: event.target.value })} /></label><label>Nueva contraseña<input required minLength="8" type="password" autoComplete="new-password" value={passwordForm.new_password} onChange={event => setPasswordForm({ ...passwordForm, new_password: event.target.value })} /></label><button className="primary-button">Cambiar y cerrar sesiones</button></form><section className="panel account-panel"><h2>Privacidad</h2><p>Descarga una copia estructurada de tus datos personales.</p><button className="secondary-button" onClick={exportData}>Exportar mis datos</button><form onSubmit={requestDeletion}><label>Contraseña para solicitar supresión<input required minLength="8" type="password" autoComplete="current-password" value={deletionPassword} onChange={event => setDeletionPassword(event.target.value)} /></label><button className="text-button danger-button">Solicitar supresión</button></form></section></div>
    {preferences && <section className="panel preference-panel"><h2>Preferencias</h2>{[
      ['in_app_enabled', 'Avisos dentro de la plataforma'], ['telegram_enabled', 'Avisos por Telegram'],
      ['assignment_notifications', 'Nuevas asignaciones'], ['progress_notifications', 'Formaciones en proceso y finalizadas'],
      ['session_notifications', 'Sesiones de mañana, de hoy y cambios'],
    ].map(([key, label]) => <label className="check-label" key={key}><input type="checkbox" checked={preferences[key]} onChange={event => savePreferences({ ...preferences, [key]: event.target.checked })} /> {label}</label>)}</section>}
    <section className="panel notification-panel"><div className="section-title"><div><span className="eyebrow">{unreadCount ? `${unreadCount} sin leer` : 'Todo al día'}</span><h2>Centro de notificaciones</h2><p>Asignaciones, progreso, finalizaciones y sesiones próximas en un único lugar.</p></div><button className="text-button" onClick={markAllRead} disabled={!unreadCount}>Marcar todo como leído</button></div><div className="notification-filters" role="group" aria-label="Filtrar notificaciones">{[
      ['all', 'Todas'], ['unread', `Sin leer (${unreadCount})`], ['training', 'Formaciones'], ['sessions', 'Sesiones'],
    ].map(([key, label]) => <button type="button" key={key} className={notificationFilter === key ? 'active' : ''} aria-pressed={notificationFilter === key} onClick={() => setNotificationFilter(key)}>{label}</button>)}</div>{loading ? <p>Cargando…</p> : visibleNotifications.length ? <div className="notification-list">{visibleNotifications.map(item => {
      const Icon = item.type?.startsWith('Session') ? Clock3 : BookOpen;
      return <article className={item.read_at ? 'read' : 'unread'} key={item.id}><Icon aria-hidden="true" /><div><span className="notification-type">{notificationTypeLabels[item.type] || 'Aviso'}</span><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString('es-ES')}</small>{item.action_url && <a className="text-button notification-action" href={item.action_url} onClick={() => markRead(item)}>Abrir detalle</a>}</div>{item.read_at ? <CheckCircle2 aria-label="Leído" /> : <button type="button" className="notification-read-button" onClick={() => markRead(item)} aria-label={`Marcar como leído: ${item.title}`}>Marcar leído</button>}</article>;
    })}</div> : <div className="empty-state compact-empty"><Bell /><h3>No hay avisos en este filtro</h3><p>Te avisaremos de asignaciones, progreso y sesiones próximas.</p></div>}</section>
  </section>;
}

export function ReportsOverview() {
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const load = async () => { try { setReport((await api.get('/reports/overview')).data); setError(''); } catch (requestError) { setError(requestError.response?.data?.detail || 'No se pudo cargar el informe'); } };
  useEffect(() => { load(); }, []);
  const statusNames = { assigned: 'Asignadas', in_progress: 'En curso', completed: 'Completadas', cancelled: 'Canceladas' };
  return <section><div className="page-heading"><div><span className="eyebrow">Seguimiento</span><h1>Informes</h1><p>Vista agregada de inscripciones, sesiones y asistencia dentro de tu ámbito.</p></div><button className="secondary-button" onClick={load}><RefreshCw size={16} /> Actualizar</button></div>{error ? <div className="inline-alert warning" role="alert">{error}</div> : report ? <><div className="stat-grid">{Object.entries(report.enrollments).map(([key, value]) => <article className="stat-card" key={key}><div><strong>{value}</strong><span>{statusNames[key] || key}</span></div></article>)}<article className="stat-card"><CalendarDays /><div><strong>{report.sessions}</strong><span>Sesiones</span></div></article></div><div className="panel report-panel"><h2>Asistencia registrada</h2>{Object.keys(report.attendance).length ? Object.entries(report.attendance).map(([key, value]) => <p key={key}><span>{key}</span><strong>{value}</strong></p>) : <p>Aún no hay registros de asistencia.</p>}</div></> : <div className="panel empty-state"><span className="loader" /><p>Cargando informe…</p></div>}</section>;
}

export function AttendanceManager({ session, onClose }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get(`/sessions/${encodeURIComponent(session.id)}/attendance`).then(({ data }) => setRows(data.map(item => ({
      user: item.user, status: item.attendance?.status || 'absent', minutes: item.attendance?.minutes || 0, notes: item.attendance?.notes || '',
    })))).catch(error => toast.error(error.response?.data?.detail || 'No se pudo cargar la asistencia'));
  }, [session.id]);
  const update = (userId, changes) => setRows(items => items.map(item => item.user.id === userId ? { ...item, ...changes } : item));
  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/sessions/${encodeURIComponent(session.id)}/attendance`, { entries: rows.map(item => ({ user_id: item.user.id, status: item.status, minutes: Number(item.minutes), notes: item.notes || null })) });
      toast.success('Asistencia guardada'); onClose();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo guardar la asistencia'); }
    finally { setSaving(false); }
  };
  return <section className="panel attendance-panel"><div className="section-title"><div><span className="eyebrow">Asistencia</span><h2>{session.title}</h2></div><button className="text-button" onClick={onClose}>Cerrar</button></div>{rows.length ? <div className="attendance-list">{rows.map(item => <div key={item.user.id}><strong>{item.user.name}</strong><select aria-label={`Asistencia de ${item.user.name}`} value={item.status} onChange={event => update(item.user.id, { status: event.target.value })}><option value="absent">Ausente</option><option value="partial">Parcial</option><option value="attended">Asistió</option><option value="excused">Justificada</option></select><input aria-label={`Minutos de ${item.user.name}`} type="number" min="0" max="1440" value={item.minutes} onChange={event => update(item.user.id, { minutes: event.target.value })} /><input aria-label={`Notas de ${item.user.name}`} placeholder="Notas opcionales" value={item.notes} onChange={event => update(item.user.id, { notes: event.target.value })} /></div>)}</div> : <p>No hay participantes convocados.</p>}<button className="primary-button" disabled={saving || !rows.length} onClick={save}>{saving ? 'Guardando…' : 'Guardar asistencia'}</button></section>;
}

function localDateTimeValue(value) {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function SessionEditor({ session, onClose, onSaved }) {
  const initialDuration = Math.max(5, Math.round((new Date(session.ends_at) - new Date(session.starts_at)) / 60_000));
  const [form, setForm] = useState({
    title: session.title, description: session.description || '', starts_at_local: localDateTimeValue(session.starts_at),
    duration_minutes: initialDuration, timezone: session.timezone, join_window_minutes: session.join_window_minutes,
    status: session.status, meeting_url: '', replace_meeting: false,
  });
  const [candidates, setCandidates] = useState([]);
  const [participantIds, setParticipantIds] = useState([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    Promise.all([
      api.get(`/sessions/eligible-users?content_id=${encodeURIComponent(session.content_id)}`),
      api.get(`/sessions/${encodeURIComponent(session.id)}/participants`),
    ]).then(([eligible, selected]) => { setCandidates(eligible.data); setParticipantIds(selected.data.map(item => item.id)); })
      .catch(error => toast.error(error.response?.data?.detail || 'No se pudieron cargar los participantes'));
  }, [session.id, session.content_id]);
  const save = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const startsAt = new Date(form.starts_at_local);
      const payload = {
        title: form.title, description: form.description || null, starts_at: startsAt.toISOString(),
        ends_at: new Date(startsAt.getTime() + Number(form.duration_minutes) * 60_000).toISOString(),
        timezone: form.timezone, join_window_minutes: Number(form.join_window_minutes), status: form.status,
      };
      if (form.replace_meeting) payload.meeting_url = form.meeting_url || null;
      await api.patch(`/sessions/${encodeURIComponent(session.id)}`, payload);
      await api.put(`/sessions/${encodeURIComponent(session.id)}/participants`, { user_ids: participantIds });
      toast.success('Sesión actualizada'); onSaved(); onClose();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo actualizar la sesión'); }
    finally { setSaving(false); }
  };
  const cancel = async () => {
    if (!window.confirm('¿Cancelar la sesión y enviar el aviso correspondiente?')) return;
    setSaving(true);
    try { await api.delete(`/sessions/${encodeURIComponent(session.id)}`); toast.success('Sesión cancelada'); onSaved(); onClose(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo cancelar la sesión'); }
    finally { setSaving(false); }
  };
  return <section className="panel session-manager"><div className="section-title"><div><span className="eyebrow">Gestión de sesión</span><h2>{session.title}</h2></div><button className="text-button" onClick={onClose}>Cerrar</button></div><form className="session-form" onSubmit={save}><label className="wide">Título<input required minLength="2" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label className="wide">Descripción<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><label>Inicio<input required type="datetime-local" value={form.starts_at_local} onChange={event => setForm({ ...form, starts_at_local: event.target.value })} /></label><label>Duración (minutos)<input required type="number" min="5" max="1440" value={form.duration_minutes} onChange={event => setForm({ ...form, duration_minutes: event.target.value })} /></label><label>Zona horaria<input required value={form.timezone} onChange={event => setForm({ ...form, timezone: event.target.value })} /></label><label>Ventana previa<input required type="number" min="0" max="180" value={form.join_window_minutes} onChange={event => setForm({ ...form, join_window_minutes: event.target.value })} /></label><label>Estado<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}><option value="scheduled">Programada</option><option value="live">En directo</option><option value="ended">Finalizada</option></select></label><label className="check-label"><input type="checkbox" checked={form.replace_meeting} onChange={event => setForm({ ...form, replace_meeting: event.target.checked })} /> Cambiar o retirar enlace de reunión</label>{form.replace_meeting && <label className="wide">Nuevo enlace; vacío para retirarlo<input type="url" pattern="https://.*" value={form.meeting_url} onChange={event => setForm({ ...form, meeting_url: event.target.value })} /></label>}<fieldset className="wide assignment-user-picker"><legend>Participantes explícitos; vacío utiliza las inscripciones</legend>{candidates.map(person => <label key={person.id}><input type="checkbox" checked={participantIds.includes(person.id)} onChange={() => setParticipantIds(current => current.includes(person.id) ? current.filter(id => id !== person.id) : [...current, person.id])} /><span><strong>{person.name}</strong><small>{person.email}</small></span></label>)}</fieldset><div className="wide session-manager-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{!['ended', 'cancelled'].includes(session.status) && <button type="button" className="secondary-button danger-button" disabled={saving} onClick={cancel}><Trash2 size={16} /> Cancelar sesión</button>}</div></form></section>;
}

export function LearningAchievements({ canCreate, canAssign, content, users }) {
  const [paths, setPaths] = useState([]);
  const [mine, setMine] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', content_ids: [] });
  const [assignment, setAssignment] = useState({ path_id: '', user_ids: [] });
  const load = async () => {
    const [pathResult, mineResult, certificateResult] = await Promise.all([api.get('/learning-paths'), api.get('/learning-paths/me'), api.get('/certificates/me')]);
    setPaths(pathResult.data); setMine(mineResult.data); setCertificates(certificateResult.data);
  };
  useEffect(() => { load().catch(error => toast.error(error.response?.data?.detail || 'No se pudieron cargar los itinerarios')); }, []);
  const toggle = (key, id) => setForm(current => ({ ...current, [key]: current[key].includes(id) ? current[key].filter(value => value !== id) : [...current[key], id] }));
  const create = async event => {
    event.preventDefault();
    try { await api.post('/learning-paths', { ...form, is_active: true }); setForm({ title: '', description: '', content_ids: [] }); toast.success('Itinerario creado'); load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo crear el itinerario'); }
  };
  const assign = async event => {
    event.preventDefault();
    try { await api.post(`/learning-paths/${assignment.path_id}/assign`, { user_ids: assignment.user_ids }); setAssignment({ path_id: '', user_ids: [] }); toast.success('Itinerario asignado'); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo asignar el itinerario'); }
  };
  return <section><div className="page-heading"><div><span className="eyebrow">Desarrollo</span><h1>Itinerarios y certificados</h1><p>Completa secuencias de formación y conserva evidencias verificables de tus logros.</p></div></div>
    {canCreate && <form className="panel path-form" onSubmit={create}><h2>Nuevo itinerario</h2><label>Título<input required minLength="2" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label>Descripción<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><fieldset><legend>Formaciones publicadas</legend>{content.filter(item => item.status === 'published').map(item => <label key={item.id}><input type="checkbox" checked={form.content_ids.includes(item.id)} onChange={() => toggle('content_ids', item.id)} /> {item.title}</label>)}</fieldset><button className="primary-button" disabled={!form.content_ids.length}>Crear itinerario</button></form>}
    {canAssign && <form className="panel path-form" onSubmit={assign}><h2>Asignar itinerario</h2><label>Itinerario<select required value={assignment.path_id} onChange={event => setAssignment({ ...assignment, path_id: event.target.value })}><option value="">Seleccionar</option>{paths.filter(item => item.is_active).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><fieldset><legend>Destinatarios</legend>{users.map(person => <label key={person.id}><input type="checkbox" checked={assignment.user_ids.includes(person.id)} onChange={() => setAssignment(current => ({ ...current, user_ids: current.user_ids.includes(person.id) ? current.user_ids.filter(id => id !== person.id) : [...current.user_ids, person.id] }))} /> {person.name}</label>)}</fieldset><button className="primary-button" disabled={!assignment.path_id || !assignment.user_ids.length}>Asignar</button></form>}
    <div className="achievement-grid"><section className="panel"><h2>Mis itinerarios</h2>{mine.length ? mine.map(item => <article key={item.id}><strong>{item.title}</strong><span>{item.completed_count}/{item.total_count}</span><div className="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax={item.total_count} aria-valuenow={item.completed_count}><span style={{ width: `${item.total_count ? item.completed_count / item.total_count * 100 : 0}%` }} /></div></article>) : <p>No tienes itinerarios asignados.</p>}</section><section className="panel"><h2>Mis certificados</h2>{certificates.length ? certificates.map(item => <article key={item.id}><strong>{item.content_title}</strong><small>Emitido el {new Date(item.issued_at).toLocaleDateString('es-ES')}</small><code>{item.verification_code}</code><a className="text-button" href={`/verify-certificate/${encodeURIComponent(item.verification_code)}`} target="_blank" rel="noreferrer">Ver, imprimir o guardar en PDF</a></article>) : <p>Los certificados aparecerán al completar una formación.</p>}</section></div>
  </section>;
}

export function EditorialManager({ user, content, onRefresh }) {
  const visible = user.user_type === 'formador' ? content.filter(item => item.created_by === user.id) : content;
  const [selected, setSelected] = useState(null);
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const open = async item => {
    try { setEditor((await api.get(`/content/${encodeURIComponent(item.id)}/editor`)).data); setSelected(item.id); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo abrir el editor'); }
  };
  const updateFile = (index, changes) => setEditor(current => ({ ...current, files: current.files.map((file, fileIndex) => fileIndex === index ? { ...file, ...changes } : file) }));
  const save = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const payload = {
        title: editor.title, description: editor.description || null, is_public: editor.is_public,
        category_ids: editor.category_ids || [], files: editor.files, quizzes: editor.quizzes,
        training_date: editor.training_date || null, audience: editor.audience || null,
        duration_minutes: editor.duration_minutes ? Number(editor.duration_minutes) : null,
        trainer_names: editor.trainer_names || [], tags: editor.tags || [],
      };
      setEditor((await api.patch(`/content/${encodeURIComponent(editor.id)}`, payload)).data);
      toast.success('Contenido guardado'); onRefresh();
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo guardar el contenido'); }
    finally { setSaving(false); }
  };
  const submitReview = async () => {
    setSaving(true);
    try { setEditor((await api.post(`/content/${encodeURIComponent(editor.id)}/submit-review`)).data); toast.success('Contenido enviado a revisión'); onRefresh(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo enviar a revisión'); }
    finally { setSaving(false); }
  };
  return <section><div className="page-heading"><div><span className="eyebrow">Flujo editorial</span><h1>Mis contenidos</h1><p>Edita recursos y evaluaciones, consulta observaciones y envía cambios a revisión.</p></div></div><div className="editorial-layout"><aside className="panel editorial-list">{visible.map(item => <button type="button" className={selected === item.id ? 'active' : ''} key={item.id} onClick={() => open(item)}><strong>{item.title}</strong><span className={`status ${item.status === 'published' ? 'success' : item.status === 'changes_requested' ? 'danger' : ''}`}>{item.status}</span></button>)}</aside>{editor ? <form className="panel editor-form editorial-form" onSubmit={save}>{editor.review_note && <div className="wide inline-alert warning" role="alert"><div><strong>Cambios solicitados</strong><p>{editor.review_note}</p></div></div>}<label className="wide">Título<input required value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} /></label><label className="wide">Descripción<textarea rows="4" value={editor.description || ''} onChange={event => setEditor({ ...editor, description: event.target.value })} /></label><label>Fecha<input type="date" value={editor.training_date || ''} onChange={event => setEditor({ ...editor, training_date: event.target.value })} /></label><label>Duración<input type="number" min="1" value={editor.duration_minutes || ''} onChange={event => setEditor({ ...editor, duration_minutes: event.target.value })} /></label><label>Personas formadoras<input value={(editor.trainer_names || []).join(', ')} onChange={event => setEditor({ ...editor, trainer_names: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><label>Etiquetas<input value={(editor.tags || []).join(', ')} onChange={event => setEditor({ ...editor, tags: event.target.value.split(',').map(value => value.trim()).filter(Boolean) })} /></label><section className="wide resource-editor"><div className="section-title"><h2>Recursos</h2><button type="button" className="secondary-button" onClick={() => setEditor({ ...editor, files: [...editor.files, { title: '', url: '', file_type: 'link' }] })}><Plus size={16} /> Recurso</button></div>{editor.files.map((file, index) => <div className="resource-row" key={file.id || index}><input required aria-label={`Título del recurso ${index + 1}`} value={file.title} onChange={event => updateFile(index, { title: event.target.value })} /><input required type="url" aria-label={`URL del recurso ${index + 1}`} value={file.url} onChange={event => updateFile(index, { url: event.target.value })} /><select aria-label={`Tipo del recurso ${index + 1}`} value={file.file_type} onChange={event => updateFile(index, { file_type: event.target.value })}><option value="link">Enlace</option><option value="video">Vídeo</option><option value="pdf">PDF</option><option value="image">Imagen</option><option value="presentation">Presentación</option><option value="document">Documento</option></select><button type="button" className="icon-button danger-button" aria-label={`Eliminar recurso ${index + 1}`} onClick={() => setEditor({ ...editor, files: editor.files.filter((_, fileIndex) => fileIndex !== index) })}><Trash2 size={16} /></button></div>)}</section><QuizEditor value={editor.quizzes || []} onChange={quizzes => setEditor({ ...editor, quizzes })} /><label className="check-label"><input type="checkbox" checked={editor.is_public} onChange={event => setEditor({ ...editor, is_public: event.target.checked })} /> Disponible públicamente cuando se publique</label><div className="wide session-manager-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>{['draft', 'changes_requested'].includes(editor.status) && <button type="button" className="secondary-button" disabled={saving} onClick={submitReview}>Enviar a revisión</button>}</div></form> : <div className="panel empty-state"><h2>Selecciona un contenido</h2><p>El editor recupera las respuestas correctas únicamente para personas autorizadas.</p></div>}</div></section>;
}

export function IntegrationOperations() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const load = async () => { try { setStatus((await api.get('/operations/integrations')).data); setError(''); } catch (requestError) { setError(requestError.response?.data?.detail || 'No se pudo cargar el estado operativo'); } };
  useEffect(() => { load(); }, []);
  const retry = async eventId => { await api.post(`/operations/outbox/${encodeURIComponent(eventId)}/retry`); toast.success('Evento preparado para reintento'); load(); };
  const resync = async sessionId => { await api.post(`/operations/calendar/${encodeURIComponent(sessionId)}/resync`); toast.success('Sincronización encolada'); load(); };
  return <section className="panel operations-panel"><div className="section-title"><div><h2>Estado de integraciones</h2><p>Supervisión del outbox, Telegram y Google Calendar.</p></div><button className="secondary-button" onClick={load}><RefreshCw size={16} /> Actualizar</button></div>{error ? <div className="inline-alert warning" role="alert">{error}</div> : status ? <><div className="operations-grid"><div><strong>{status.outbox.pending}</strong><span>Eventos pendientes</span></div><div><strong>{status.outbox.failed}</strong><span>Eventos fallidos</span></div><div><strong>{status.telegram.active_bindings}</strong><span>Telegram vinculados</span></div><div><strong>{status.google_calendar.failed}</strong><span>Calendarios fallidos</span></div></div>{status.failed_events?.map(item => <div className="operation-error" key={item.id}><span><strong>{item.event_type}</strong> · {item.last_error || 'Error'}</span><button className="text-button" onClick={() => retry(item.id)}>Reintentar</button></div>)}{status.failed_calendar_events?.map(item => <div className="operation-error" key={item.session_id}><span><strong>Calendario</strong> · {item.last_error || 'Error'}</span><button className="text-button" onClick={() => resync(item.session_id)}>Reconciliar</button></div>)}</> : <p>Cargando…</p>}</section>;
}
