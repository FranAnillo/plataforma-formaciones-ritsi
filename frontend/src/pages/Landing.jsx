import { useEffect, useState } from 'react';
import { BookOpen, ExternalLink, Layers3, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import logo from '../static/1710_Isotipo_Degradado.png';

const emptyLogin = { email: '', password: '' };
const emptyRegister = { name: '', email: '', password: '', university_id: '' };

export default function Landing({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [login, setLogin] = useState(emptyLogin);
  const [register, setRegister] = useState(emptyRegister);
  const [universities, setUniversities] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/universities').then(({ data }) => setUniversities(data.filter(item => item.is_active))).catch(() => null);
  }, []);

  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { data } = await api.post(`/auth/${mode}`, mode === 'login' ? login : register);
      onAuthenticated(data);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo completar el acceso');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <a href="/" className="brand-lockup"><img src={logo} alt="RITSI" /><span>Formación RITSI</span></a>
        <a href="https://ritsi.org" target="_blank" rel="noreferrer" className="quiet-link">ritsi.org <ExternalLink size={14} /></a>
      </nav>
      <section className="hero-grid">
        <div className="hero-copy">
          <span className="eyebrow">Conocimiento compartido</span>
          <h1>La formación de RITSI, accesible y bien organizada.</h1>
          <p>Consulta el histórico, descubre recursos y acompaña el aprendizaje de representantes, Vocalías y Junta Directiva desde un único espacio.</p>
          <div className="hero-points">
            <span><BookOpen size={18} /> Catálogo histórico</span>
            <span><Layers3 size={18} /> Recursos enlazados</span>
            <span><ShieldCheck size={18} /> Acceso por perfiles</span>
          </div>
        </div>
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Acceder</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Crear cuenta</button>
          </div>
          <form onSubmit={submit}>
            <div><span className="eyebrow">Área privada</span><h2>{mode === 'login' ? 'Te damos la bienvenida' : 'Únete a la plataforma'}</h2></div>
            {mode === 'register' && <label>Nombre completo<input required value={register.name} onChange={e => setRegister({ ...register, name: e.target.value })} autoComplete="name" /></label>}
            <label>Correo electrónico<input type="email" required value={mode === 'login' ? login.email : register.email} onChange={e => mode === 'login' ? setLogin({ ...login, email: e.target.value }) : setRegister({ ...register, email: e.target.value })} autoComplete="email" /></label>
            <label>Contraseña<input type="password" minLength="8" required value={mode === 'login' ? login.password : register.password} onChange={e => mode === 'login' ? setLogin({ ...login, password: e.target.value }) : setRegister({ ...register, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
            {mode === 'register' && <label>Universidad<select required value={register.university_id} onChange={e => setRegister({ ...register, university_id: e.target.value })}><option value="">Selecciona una universidad</option>{universities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
            <button className="primary-button" disabled={submitting}>{submitting ? 'Procesando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear mi cuenta'}</button>
          </form>
        </div>
      </section>
      <section className="feature-strip">
        <article><Users /><strong>Vocalías conectadas</strong><span>Responsables y miembros en una estructura clara.</span></article>
        <article><BookOpen /><strong>Recursos reales</strong><span>Presentaciones, documentos y grabaciones desde su fuente.</span></article>
        <article><ShieldCheck /><strong>Gobernanza fiable</strong><span>Los cinco cargos esenciales de Junta siempre protegidos.</span></article>
      </section>
    </main>
  );
}
