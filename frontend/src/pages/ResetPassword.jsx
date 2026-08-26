import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  if (!token) return <Navigate to="/" replace />;
  const submit = async event => {
    event.preventDefault();
    if (password !== confirmation) return toast.error('Las contraseñas no coinciden');
    setSaving(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      toast.success('Contraseña actualizada. Ya puedes iniciar sesión.');
      navigate('/', { replace: true });
    } catch (error) { toast.error(error.response?.data?.detail || 'No se pudo actualizar la contraseña'); }
    finally { setSaving(false); }
  };
  return <main className="reset-page"><section className="auth-card"><div className="auth-heading"><span className="eyebrow">Recuperación segura</span><h1>Nueva contraseña</h1><p>El enlace solo puede utilizarse una vez.</p></div><form onSubmit={submit}><label>Nueva contraseña<input autoFocus required minLength="8" maxLength="128" type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label>Repetir contraseña<input required minLength="8" maxLength="128" type="password" autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><button className="primary-button" disabled={saving || password.length < 8}>{saving ? 'Actualizando…' : 'Guardar contraseña'}</button></form></section></main>;
}
