import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, Check, Clock3, ExternalLink, FileText, PlayCircle, RefreshCw, Star, Users } from 'lucide-react';
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
  const [quizResults, setQuizResults] = useState({});
  const [loading, setLoading] = useState(true);
  const [contentError, setContentError] = useState('');
  const [progressError, setProgressError] = useState('');
  const [savingResources, setSavingResources] = useState([]);
  const [resourceErrors, setResourceErrors] = useState({});

  const loadProgress = useCallback(async () => {
    setProgressError('');
    try {
      let progress;
      try {
        progress = (await api.get(`/progress/me/${contentId}`)).data;
      } catch (error) {
        if (![404, 405].includes(error.response?.status)) throw error;
        const response = await api.get('/progress');
        progress = response.data.find(item => item.content_id === contentId && (!item.user_id || item.user_id === user.id));
      }
      setCompleted(progress?.files_completed || []);
      setQuizResults(progress?.quizzes_completed || {});
      return true;
    } catch (error) {
      setProgressError(error.response?.data?.detail || 'No se pudo recuperar tu progreso. La formación sigue disponible.');
      return false;
    }
  }, [contentId, user.id]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setContentError('');

    const [contentResult] = await Promise.allSettled([
      api.get(`/content/${contentId}`),
      loadProgress(),
    ]);

    if (contentResult.status === 'fulfilled') {
      setContent(contentResult.value.data);
    } else {
      setContent(null);
      setContentError(contentResult.reason?.response?.data?.detail || 'No se pudo cargar la formación.');
    }
    setLoading(false);
  }, [contentId, loadProgress]);

  useEffect(() => { loadContent(); }, [loadContent]);

  const markResource = async resource => {
    if (completed.includes(resource.id) || savingResources.includes(resource.id)) return;
    setSavingResources(current => [...current, resource.id]);
    setResourceErrors(current => ({ ...current, [resource.id]: '' }));
    try {
      await api.post('/progress/file-completed', { content_id: contentId, file_id: resource.id });
      setCompleted(current => current.includes(resource.id) ? current : [...current, resource.id]);
    } catch (error) {
      const message = error.response?.data?.detail || 'No se pudo guardar este avance.';
      setResourceErrors(current => ({ ...current, [resource.id]: message }));
      toast.error(message);
    } finally {
      setSavingResources(current => current.filter(id => id !== resource.id));
    }
  };

  const openResource = resource => {
    window.open(resource.url, '_blank', 'noopener,noreferrer');
    markResource(resource);
  };

  return <DashboardLayout user={user} onLogout={onLogout} tabs={[{ id: 'back', label: 'Volver a Mi formación', icon: ArrowLeft }]} activeTab="" onTabChange={() => navigate('/dashboard')}>
    {loading ? <div className="panel empty-state" role="status"><span className="loader" /><p>Cargando formación…</p></div> : content ? <section className="content-detail">
      <button className="back-link" onClick={() => navigate('/dashboard')}><ArrowLeft size={17} aria-hidden="true" /> Volver a Mi formación</button>

      {progressError && <div className="inline-alert warning" role="alert"><AlertCircle aria-hidden="true" /><div><strong>Tu progreso no está disponible</strong><p>{progressError}</p></div><button type="button" className="secondary-button" onClick={loadProgress}><RefreshCw size={16} aria-hidden="true" /> Reintentar</button></div>}

      <div className="detail-hero"><div><div className="detail-chips"><span>{content.academic_year || 'Formación RITSI'}</span>{content.source_code && <span>{content.source_code}</span>}</div><h1>{content.title}</h1><p>{content.description || 'Material formativo del catálogo de RITSI.'}</p><div className="detail-meta">{content.training_date && <span><CalendarDays aria-hidden="true" />{new Date(`${content.training_date}T00:00:00`).toLocaleDateString('es-ES')}</span>}{content.duration_minutes && <span><Clock3 aria-hidden="true" />{content.duration_minutes} minutos</span>}{content.audience && <span><Users aria-hidden="true" />{content.audience}</span>}{content.rating && <span><Star aria-hidden="true" />{content.rating.toFixed(1)} / 5</span>}</div></div></div>
      <div className="detail-grid"><div><section className="panel resource-list"><div className="section-title"><div><span className="eyebrow">Materiales</span><h2>Recursos de la formación</h2></div><span role="status">{completed.length}/{content.files?.length || 0} consultados</span></div>{content.files?.length ? content.files.map(resource => {
        const Icon = resourceIcons[resource.file_type] || ExternalLink;
        const done = completed.includes(resource.id);
        const saving = savingResources.includes(resource.id);
        const resourceError = resourceErrors[resource.id];
        return <div className="resource-entry" key={resource.id}>
          <button className="resource-item" onClick={() => openResource(resource)} aria-describedby={resourceError ? `resource-error-${resource.id}` : undefined}>
            <span className="resource-type"><Icon aria-hidden="true" /></span>
            <span><strong>{resource.title}</strong><small>{resource.description || 'Abrir recurso original en una nueva pestaña'}</small></span>
            {done ? <span className="done"><Check aria-hidden="true" /> Consultado</span> : saving ? <span className="saving-label" role="status">Guardando…</span> : <ExternalLink aria-hidden="true" />}
          </button>
          {resourceError && <div id={`resource-error-${resource.id}`} className="resource-save-error" role="alert"><span>{resourceError}</span><button type="button" className="text-button" onClick={() => markResource(resource)}>Reintentar guardado</button></div>}
        </div>;
      }) : <div className="empty-state"><FileText aria-hidden="true" /><h3>Sin recursos enlazados</h3><p>Esta ficha conserva sus metadatos históricos.</p></div>}</section>{content.quizzes?.map(quiz => <QuizPanel key={quiz.id} quiz={quiz} contentId={contentId} result={quizResults[quiz.id]} onResult={result => setQuizResults(current => ({ ...current, [quiz.id]: result }))} />)}</div><aside className="panel detail-aside"><h2>Sobre esta formación</h2>{content.trainer_names?.length > 0 && <div><small>Personas formadoras</small><strong>{content.trainer_names.join(', ')}</strong></div>}{content.audience && <div><small>Dirigida a</small><strong>{content.audience}</strong></div>}{content.tags?.length > 0 && <div><small>Etiquetas</small><div className="tag-row">{content.tags.map(tag => <span key={tag}>{tag}</span>)}</div></div>}<p>Los materiales se abren desde su ubicación original para conservar permisos y versiones.</p></aside></div>
    </section> : <div className="panel empty-state" role="alert"><AlertCircle aria-hidden="true" /><h2>No se pudo abrir la formación</h2><p>{contentError}</p><div className="empty-actions"><button className="secondary-button" onClick={() => navigate('/dashboard')}>Volver</button><button className="primary-button" onClick={loadContent}><RefreshCw size={16} aria-hidden="true" /> Reintentar</button></div></div>}
  </DashboardLayout>;
}

function QuizPanel({ quiz, contentId, result, onResult }) {
  const [answers, setAnswers] = useState({});
  const [saving, setSaving] = useState(false);
  const select = (question, optionIndex, checked) => {
    const current = answers[question.id] || [];
    const next = question.question_type === 'multiple_response'
      ? checked ? [...new Set([...current, optionIndex])] : current.filter(index => index !== optionIndex)
      : [optionIndex];
    setAnswers(value => ({ ...value, [question.id]: next }));
  };
  const submit = async event => {
    event.preventDefault(); setSaving(true);
    try {
      const { data } = await api.post('/progress/submit-quiz', { content_id: contentId, quiz_id: quiz.id, answers });
      onResult(data);
      toast[data.passed ? 'success' : 'warning'](data.passed ? 'Evaluación superada' : 'Aún no has alcanzado la puntuación mínima');
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo enviar la evaluación'); }
    finally { setSaving(false); }
  };
  return <form className="panel quiz-panel" onSubmit={submit}><div className="section-title"><div><span className="eyebrow">Evaluación</span><h2>{quiz.title}</h2></div>{result && <span className={`status ${result.passed ? 'success' : 'danger'}`}>{Math.round(result.score)}% · {result.passed ? 'Superada' : 'No superada'}</span>}</div>{quiz.questions.map((question, questionIndex) => <fieldset key={question.id}><legend>{questionIndex + 1}. {question.question_text}</legend>{question.options.map((option, optionIndex) => <label key={optionIndex}><input required={question.question_type !== 'multiple_response'} type={question.question_type === 'multiple_response' ? 'checkbox' : 'radio'} name={question.id} checked={(answers[question.id] || []).includes(optionIndex)} onChange={event => select(question, optionIndex, event.target.checked)} /> {option}</label>)}</fieldset>)}<button className="primary-button" disabled={saving || quiz.questions.some(question => !(answers[question.id] || []).length)}>{saving ? 'Corrigiendo…' : result?.passed ? 'Repetir evaluación' : 'Enviar evaluación'}</button></form>;
}
