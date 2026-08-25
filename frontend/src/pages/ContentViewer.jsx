import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, FileText, PlayCircle, Star, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import api from '../services/api';

const resourceIcons = { video: PlayCircle, presentation: FileText, document: FileText, pdf: FileText, image: FileText, link: ExternalLink };

export default function ContentViewer({ user, onLogout }) {
  const { contentId } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [completed, setCompleted] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get(`/content/${contentId}`), api.get('/progress')]).then(([contentResponse, progressResponse]) => {
      setContent(contentResponse.data);
      const progress = progressResponse.data.find(item => item.content_id === contentId);
      setCompleted(progress?.files_completed || []);
    }).catch(error => toast.error(error.response?.data?.detail || 'No se pudo cargar la formación')).finally(() => setLoading(false));
  }, [contentId]);

  const openResource = async resource => {
    window.open(resource.url, '_blank', 'noopener,noreferrer');
    if (!completed.includes(resource.id)) {
      setCompleted([...completed, resource.id]);
      await api.post('/progress/file-completed', { content_id: contentId, file_id: resource.id }).catch(() => null);
    }
  };

  return <DashboardLayout user={user} onLogout={onLogout} tabs={[{ id: 'back', label: 'Volver al catálogo', icon: ArrowLeft }]} activeTab="" onTabChange={() => navigate('/dashboard')}>
    {loading ? <div className="panel empty-state"><span className="loader" /></div> : content ? <section className="content-detail">
      <button className="back-link" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} /> Volver al catálogo</button>
      <div className="detail-hero"><div><div className="detail-chips"><span>{content.academic_year || 'Formación RITSI'}</span>{content.source_code && <span>{content.source_code}</span>}</div><h1>{content.title}</h1><p>{content.description || 'Material formativo del catálogo de RITSI.'}</p><div className="detail-meta">{content.training_date && <span><CalendarDays />{new Date(`${content.training_date}T00:00:00`).toLocaleDateString('es-ES')}</span>}{content.duration_minutes && <span><Clock3 />{content.duration_minutes} minutos</span>}{content.audience && <span><Users />{content.audience}</span>}{content.rating && <span><Star />{content.rating.toFixed(1)} / 5</span>}</div></div></div>
      <div className="detail-grid"><div><section className="panel resource-list"><div className="section-title"><div><span className="eyebrow">Materiales</span><h2>Recursos de la formación</h2></div><span>{completed.length}/{content.files?.length || 0} consultados</span></div>{content.files?.length ? content.files.map(resource => { const Icon = resourceIcons[resource.file_type] || ExternalLink; const done = completed.includes(resource.id); return <button className="resource-item" key={resource.id} onClick={() => openResource(resource)}><span className="resource-type"><Icon /></span><span><strong>{resource.title}</strong><small>{resource.description || 'Abrir recurso original en una nueva pestaña'}</small></span>{done ? <span className="done"><Check /> Consultado</span> : <ExternalLink />}</button>; }) : <div className="empty-state"><FileText /><h3>Sin recursos enlazados</h3><p>Esta ficha conserva sus metadatos históricos.</p></div>}</section></div><aside className="panel detail-aside"><h2>Sobre esta formación</h2>{content.trainer_names?.length > 0 && <div><small>Personas formadoras</small><strong>{content.trainer_names.join(', ')}</strong></div>}{content.audience && <div><small>Dirigida a</small><strong>{content.audience}</strong></div>}{content.tags?.length > 0 && <div><small>Etiquetas</small><div className="tag-row">{content.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>}<p>Los materiales se abren desde su ubicación original para conservar permisos y versiones.</p></aside></div>
    </section> : <div className="panel empty-state"><h2>Formación no encontrada</h2></div>}
  </DashboardLayout>;
}
