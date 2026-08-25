import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Building2, CalendarDays, Download, ExternalLink, FilePlus2, LayoutGrid, Plus, Search, ShieldCheck, Sparkles, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';
import { boardPositionNames, roleNames } from '../utils/roles';

const SHEET_ID = '1JSRrepNNdQDl6zeroZPDKUJztLhSC3j6r7y2h_ND09c';
const sheetUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
const positions = [
  'presidencia', 'vicepresidencia_politica_universitaria', 'tesoreria', 'secretaria',
  'vicepresidencia_comunicacion', 'miembro_adicional_1', 'miembro_adicional_2'
];
const emptyFormation = { title: '', description: '', training_date: '', audience: '', duration_minutes: '', trainer_names: '', tags: '', is_public: true, files: [{ title: 'Presentación', url: '', file_type: 'presentation' }] };
const emptyUser = { name: '', email: '', password: '', user_type: 'representante', university_id: '' };
const emptyVocalia = { name: '', description: '', board_member_id: '' };
const emptyUniversity = { name: '', zone: '' };

export default function Dashboard({ user, onLogout }) {
  const navigate = useNavigate();
  const isAdmin = user.user_type === 'admin';
  const isBoard = user.user_type === 'junta_directiva';
  const canAuthor = isAdmin || isBoard || user.user_type === 'formador';
  const [tab, setTab] = useState('catalog');
  const [data, setData] = useState({ content: [], vocalias: [], users: [], board: [], universities: [], progress: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('all');
  const [formation, setFormation] = useState(emptyFormation);
  const [newUser, setNewUser] = useState(emptyUser);
  const [vocalia, setVocalia] = useState(emptyVocalia);
  const [university, setUniversity] = useState(emptyUniversity);
  const [selectedVocalia, setSelectedVocalia] = useState(null);
  const [memberIds, setMemberIds] = useState([]);
  const [boardSlots, setBoardSlots] = useState(positions.slice(0, 5).map(position => ({ position, user_id: '' })));
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const requests = [api.get('/content'), api.get('/vocalias'), api.get('/progress')];
    if (isAdmin || isBoard) requests.push(api.get('/users'), api.get('/board'));
    if (isAdmin) requests.push(api.get('/universities'));
    try {
      const responses = await Promise.all(requests);
      const next = { content: responses[0].data, vocalias: responses[1].data, progress: responses[2].data, users: [], board: [], universities: [] };
      if (isAdmin || isBoard) {
        next.users = responses[3].data;
        next.board = responses[4].data;
      }
      if (isAdmin) next.universities = responses[5].data;
      setData(next);
      if (next.board.length) {
        const configured = positions.slice(0, 5).map(position => ({ position, user_id: next.board.find(item => item.board_position === position)?.id || '' }));
        next.board.filter(item => item.board_position?.startsWith('miembro_adicional')).forEach(item => configured.push({ position: item.board_position, user_id: item.id }));
        setBoardSlots(configured);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const years = useMemo(() => [...new Set(data.content.map(item => item.academic_year).filter(Boolean))], [data.content]);
  const filtered = useMemo(() => data.content.filter(item => {
    const text = `${item.title} ${item.description || ''} ${(item.tags || []).join(' ')} ${(item.trainer_names || []).join(' ')}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (year === 'all' || item.academic_year === year);
  }), [data.content, query, year]);
  const published = data.content.filter(item => item.status === 'published').length;
  const resources = data.content.reduce((total, item) => total + (item.files?.length || 0), 0);

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
      const { data: result } = await api.post('/content/import-sheet', { spreadsheet_id: SHEET_ID, publish: true });
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

  const resetPassword = async person => {
    const password = window.prompt(`Nueva contraseña temporal para ${person.name} (mínimo 8 caracteres):`);
    if (!password) return;
    try { await api.put(`/users/${person.id}`, { password }); toast.success('Contraseña actualizada'); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo actualizar la contraseña'); }
  };

  const toggleUser = async person => {
    try { await api.put(`/users/${person.id}`, { is_active: !person.is_active }); toast.success('Estado actualizado'); await load(); }
    catch (error) { toast.error(error.response?.data?.detail || 'No se pudo cambiar el estado'); }
  };

  const tabs = [
    { id: 'catalog', label: 'Catálogo', icon: BookOpen },
    { id: 'vocalias', label: 'Vocalías', icon: LayoutGrid },
    ...(canAuthor ? [{ id: 'create', label: 'Nueva formación', icon: FilePlus2 }] : []),
    ...(isAdmin ? [{ id: 'board', label: 'Junta Directiva', icon: ShieldCheck }, { id: 'users', label: 'Usuarios', icon: Users }, { id: 'universities', label: 'Universidades', icon: Building2 }, { id: 'source', label: 'Fuente de datos', icon: Download }] : []),
  ];

  return (
    <DashboardLayout user={user} onLogout={onLogout} tabs={tabs} activeTab={tab} onTabChange={setTab}>
      {loading ? <div className="panel empty-state"><span className="loader" /><p>Preparando tu espacio…</p></div> : <>
        {tab === 'catalog' && <section>
          <div className="page-heading"><div><span className="eyebrow">Biblioteca formativa</span><h1>Todo el conocimiento, en un solo lugar</h1><p>Explora el catálogo y abre los recursos originales asociados a cada formación.</p></div></div>
          <div className="stat-grid"><Stat icon={BookOpen} value={published} label="Formaciones publicadas" /><Stat icon={ExternalLink} value={resources} label="Recursos disponibles" /><Stat icon={CalendarDays} value={years.length} label="Cursos académicos" /></div>
          <div className="catalog-toolbar"><label className="search-box"><Search size={18} /><input aria-label="Buscar formaciones" placeholder="Buscar por título, etiqueta o persona…" value={query} onChange={event => setQuery(event.target.value)} /></label><select value={year} onChange={event => setYear(event.target.value)}><option value="all">Todos los cursos</option>{years.map(item => <option key={item}>{item}</option>)}</select></div>
          <div className="content-grid">{filtered.map(item => <TrainingCard key={item.id} item={item} onClick={() => navigate(`/content/${item.id}`)} canApprove={(isAdmin || isBoard) && item.status === 'pending'} onApprove={async event => { event.stopPropagation(); await api.post(`/content/${item.id}/approve`); toast.success('Formación publicada'); load(); }} />)}</div>
          {!filtered.length && <div className="panel empty-state"><Search /><h3>No hay resultados</h3><p>Prueba con otra búsqueda o curso académico.</p></div>}
        </section>}

        {tab === 'vocalias' && <section>
          <div className="page-heading"><div><span className="eyebrow">Organización</span><h1>Vocalías</h1><p>Cada Vocalía está acompañada por una persona de Junta Directiva y reúne a su equipo.</p></div></div>
          {isAdmin && <form className="panel compact-form" onSubmit={createVocalia}><div><h2>Crear Vocalía</h2><p>Define su propósito y la persona responsable.</p></div><label>Nombre<input required value={vocalia.name} onChange={e => setVocalia({ ...vocalia, name: e.target.value })} /></label><label>Responsable de Junta<select required value={vocalia.board_member_id} onChange={e => setVocalia({ ...vocalia, board_member_id: e.target.value })}><option value="">Seleccionar</option>{data.board.map(item => <option key={item.id} value={item.id}>{item.name} · {boardPositionNames[item.board_position]}</option>)}</select></label><label className="wide">Descripción<textarea value={vocalia.description} onChange={e => setVocalia({ ...vocalia, description: e.target.value })} /></label><button className="primary-button" disabled={saving}><Plus size={16} /> Crear Vocalía</button></form>}
          <div className="vocalia-grid">{data.vocalias.map(item => { const owner = data.board.find(person => person.id === item.board_member_id); const members = data.users.filter(person => person.vocalia_ids?.includes(item.id)); const canManage = isAdmin || (isBoard && item.board_member_id === user.id); return <article className="panel vocalia-card" key={item.id}><div className="vocalia-monogram">{item.name.slice(0, 2).toUpperCase()}</div><h2>{item.name}</h2><p>{item.description || 'Sin descripción añadida.'}</p><div className="owner"><ShieldCheck size={17} /><span><small>Responsable</small>{owner?.name || 'Persona de Junta'}</span></div><div className="member-row"><span>{members.length} miembros</span>{canManage && <button className="text-button" onClick={() => openMembers(item)}>Gestionar</button>}</div></article>; })}</div>
          {!data.vocalias.length && <div className="panel empty-state"><LayoutGrid /><h3>Aún no hay Vocalías</h3><p>Administración puede crear la primera desde esta pantalla.</p></div>}
        </section>}

        {tab === 'create' && <section><div className="page-heading"><div><span className="eyebrow">Autoría</span><h1>Nueva formación</h1><p>Añade metadatos claros y enlaza los materiales que utilizará el alumnado.</p></div></div><form className="panel editor-form" onSubmit={createFormation}><label className="wide">Título<input required value={formation.title} onChange={e => setFormation({ ...formation, title: e.target.value })} /></label><label className="wide">Descripción<textarea rows="4" value={formation.description} onChange={e => setFormation({ ...formation, description: e.target.value })} /></label><label>Fecha<input type="date" value={formation.training_date} onChange={e => setFormation({ ...formation, training_date: e.target.value })} /></label><label>Duración en minutos<input type="number" min="1" value={formation.duration_minutes} onChange={e => setFormation({ ...formation, duration_minutes: e.target.value })} /></label><label className="wide">Dirigida a<input value={formation.audience} onChange={e => setFormation({ ...formation, audience: e.target.value })} /></label><label>Personas formadoras<input placeholder="Separadas por comas" value={formation.trainer_names} onChange={e => setFormation({ ...formation, trainer_names: e.target.value })} /></label><label>Etiquetas<input placeholder="Separadas por comas" value={formation.tags} onChange={e => setFormation({ ...formation, tags: e.target.value })} /></label><div className="wide resource-editor"><div className="section-title"><div><h2>Recursos enlazados</h2><p>Añade presentaciones, documentos, vídeos u otros materiales.</p></div><button type="button" className="secondary-button" onClick={() => setFormation({ ...formation, files: [...formation.files, { title: '', url: '', file_type: 'link' }] })}><Plus size={16} /> Recurso</button></div>{formation.files.map((file, index) => <div className="resource-row" key={index}><input aria-label="Título del recurso" placeholder="Título" value={file.title} onChange={e => { const files = [...formation.files]; files[index] = { ...file, title: e.target.value }; setFormation({ ...formation, files }); }} /><input aria-label="URL del recurso" type="url" placeholder="https://…" value={file.url} onChange={e => { const files = [...formation.files]; files[index] = { ...file, url: e.target.value }; setFormation({ ...formation, files }); }} /><select value={file.file_type} onChange={e => { const files = [...formation.files]; files[index] = { ...file, file_type: e.target.value }; setFormation({ ...formation, files }); }}><option value="presentation">Presentación</option><option value="document">Documento</option><option value="pdf">PDF</option><option value="video">Vídeo</option><option value="image">Imagen</option><option value="link">Enlace</option></select>{formation.files.length > 1 && <button type="button" className="icon-button" onClick={() => setFormation({ ...formation, files: formation.files.filter((_, i) => i !== index) })}><X size={17} /></button>}</div>)}</div><label className="check-label"><input type="checkbox" checked={formation.is_public} onChange={e => setFormation({ ...formation, is_public: e.target.checked })} /> Disponible públicamente para personas registradas</label><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar formación'}</button></form></section>}

        {tab === 'board' && <section><div className="page-heading"><div><span className="eyebrow">Gobernanza</span><h1>Junta Directiva</h1><p>Los cinco cargos esenciales son obligatorios. Puedes añadir hasta dos miembros adicionales.</p></div></div><div className="panel board-editor">{boardSlots.map((slot, index) => <div className="board-slot" key={slot.position}><div><strong>{boardPositionNames[slot.position]}</strong><small>{index < 5 ? 'Cargo obligatorio' : 'Plaza adicional'}</small></div><select value={slot.user_id} onChange={e => setBoardSlots(boardSlots.map(item => item.position === slot.position ? { ...item, user_id: e.target.value } : item))}><option value="">Seleccionar persona</option>{data.users.filter(person => person.is_active && person.user_type !== 'admin').map(person => <option key={person.id} value={person.id}>{person.name} · {person.email}</option>)}</select>{index >= 5 && <button className="icon-button" onClick={() => setBoardSlots(boardSlots.filter(item => item.position !== slot.position))}><X size={17} /></button>}</div>)}<div className="board-actions">{boardSlots.length < 7 && <button className="secondary-button" onClick={() => { const next = positions.find(position => !boardSlots.some(slot => slot.position === position)); setBoardSlots([...boardSlots, { position: next, user_id: '' }]); }}><Plus size={16} /> Añadir miembro</button>}<button className="primary-button" disabled={saving} onClick={saveBoard}>Guardar composición</button></div></div></section>}

        {tab === 'users' && <section><div className="page-heading"><div><span className="eyebrow">Administración</span><h1>Usuarios</h1><p>Crea cuentas, renueva sus credenciales y consulta su pertenencia.</p></div></div><form className="panel compact-form" onSubmit={createUser}><label>Nombre<input required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} /></label><label>Correo<input required type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></label><label>Contraseña temporal<input required minLength="8" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} /></label><label>Perfil<select value={newUser.user_type} onChange={e => setNewUser({ ...newUser, user_type: e.target.value })}><option value="representante">Representante</option><option value="universidad">Universidad</option><option value="formador">Persona formadora</option><option value="colaboracion_externa">Colaboración externa</option><option value="admin">Administración</option></select></label><label>Universidad<select value={newUser.university_id} onChange={e => setNewUser({ ...newUser, university_id: e.target.value })}><option value="">No aplicable</option>{data.universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="primary-button" disabled={saving}><Plus size={16} /> Crear usuario</button></form><div className="panel table-wrap"><table><thead><tr><th>Persona</th><th>Perfil</th><th>Vocalías</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.users.map(person => <tr key={person.id}><td><strong>{person.name}</strong><small>{person.email}</small></td><td>{person.board_position ? boardPositionNames[person.board_position] : roleNames[person.user_type]}</td><td>{person.vocalia_ids?.length || 0}</td><td><span className={`status ${person.is_active ? 'success' : ''}`}>{person.is_active ? 'Activo' : 'Inactivo'}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => resetPassword(person)}>Nueva clave</button>{person.id !== user.id && <button className="text-button" onClick={() => toggleUser(person)}>{person.is_active ? 'Desactivar' : 'Activar'}</button>}</div></td></tr>)}</tbody></table></div></section>}

        {tab === 'universities' && <section><div className="page-heading"><div><span className="eyebrow">Estructura territorial</span><h1>Universidades</h1><p>Las universidades activas son socias de RITSI; las inactivas se consideran no socias y no aparecen en el formulario de registro.</p></div><button className="secondary-button" onClick={syncUniversities} disabled={saving}><Download size={16} /> {saving ? 'Sincronizando…' : 'Sincronizar desde RITSI'}</button></div><form className="panel compact-form" onSubmit={createUniversity}><label>Nombre de la universidad<input required value={university.name} onChange={e => setUniversity({ ...university, name: e.target.value })} /></label><label>Zona<select value={university.zone} onChange={e => setUniversity({ ...university, zone: e.target.value })}><option value="">Sin zona</option>{['I','II','III','IV','V'].map(zone => <option key={zone} value={zone}>Zona {zone}</option>)}</select></label><button className="primary-button" disabled={saving}><Plus size={16} /> Crear universidad socia</button></form><div className="panel table-wrap"><table><thead><tr><th>Universidad</th><th>Región</th><th>Zona</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{data.universities.map(item => <tr key={item.id}><td><strong>{item.name}</strong>{item.center_name && <small>{item.center_name}</small>}</td><td>{item.region || '—'}</td><td>{item.zone ? `Zona ${item.zone}` : 'Sin zona'}</td><td><span className={`status ${item.is_active ? 'success' : ''}`}>{item.is_active ? 'Socia · activa' : 'No socia · inactiva'}</span></td><td><div className="table-actions"><button className="text-button" onClick={() => toggleUniversity(item)}>{item.is_active ? 'Marcar no socia' : 'Marcar socia'}</button><button className="text-button" onClick={() => deleteUniversity(item)}>Eliminar</button></div></td></tr>)}</tbody></table></div></section>}

        {tab === 'source' && <section><div className="page-heading"><div><span className="eyebrow">Sincronización</span><h1>Fuente de datos</h1><p>Actualiza el catálogo desde el registro oficial manteniendo todos los enlaces disponibles.</p></div></div><div className="panel source-card"><div className="source-icon"><Download /></div><div><h2>Registro de Formaciones</h2><p>La importación es idempotente: crea nuevas entradas y actualiza las ya existentes sin duplicarlas.</p><a href={sheetUrl} target="_blank" rel="noreferrer">Abrir hoja original <ExternalLink size={14} /></a></div><button className="primary-button" onClick={importSheet} disabled={saving}>{saving ? 'Sincronizando…' : 'Sincronizar ahora'}</button></div></section>}
      </>}

      {selectedVocalia && <div className="modal-backdrop" onMouseDown={() => setSelectedVocalia(null)}><div className="modal-card" onMouseDown={e => e.stopPropagation()}><div className="section-title"><div><span className="eyebrow">Equipo</span><h2>{selectedVocalia.name}</h2></div><button className="icon-button" onClick={() => setSelectedVocalia(null)}><X /></button></div><div className="member-picker">{data.users.filter(person => person.is_active).map(person => <label key={person.id}><input type="checkbox" checked={memberIds.includes(person.id)} onChange={e => setMemberIds(e.target.checked ? [...memberIds, person.id] : memberIds.filter(id => id !== person.id))} /><span><strong>{person.name}</strong><small>{roleNames[person.user_type]}</small></span></label>)}</div><div className="modal-actions"><button className="secondary-button" onClick={() => setSelectedVocalia(null)}>Cancelar</button><button className="primary-button" disabled={saving} onClick={saveMembers}>Guardar miembros</button></div></div></div>}
    </DashboardLayout>
  );
}

function Stat({ icon: Icon, value, label }) { return <article className="stat-card"><Icon /><div><strong>{value}</strong><span>{label}</span></div></article>; }

function TrainingCard({ item, onClick, canApprove, onApprove }) {
  return <article className="training-card" onClick={onClick} role="button" tabIndex="0" onKeyDown={e => e.key === 'Enter' && onClick()}><div className="card-top"><span className="course-chip">{item.academic_year || 'Formación'}</span>{item.rating && <span className="rating"><Sparkles size={13} /> {item.rating.toFixed(1)}</span>}</div><h2>{item.title}</h2><p>{item.description || 'Consulta los materiales y detalles de esta formación.'}</p><div className="tag-row">{item.tags?.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div><div className="card-meta">{item.training_date && <span><CalendarDays size={15} /> {new Date(`${item.training_date}T00:00:00`).toLocaleDateString('es-ES')}</span>}{item.duration_minutes && <span>{item.duration_minutes} min</span>}</div><div className="card-footer"><span>{item.files?.length || 0} recursos</span>{canApprove ? <button className="text-button" onClick={onApprove}>Publicar</button> : <span className="open-label">Abrir <ExternalLink size={14} /></span>}</div></article>;
}
