import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { toast, Toaster } from 'sonner';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ContentViewer from './pages/ContentViewer';
import ResetPassword from './pages/ResetPassword';
import VerifyCertificate from './pages/VerifyCertificate';
import api from './services/api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handleExpiredSession = () => {
      setUser(null);
      toast.info('Tu sesión ha caducado. Vuelve a iniciar sesión.');
    };
    window.addEventListener('ritsi:session-expired', handleExpiredSession);
    return () => window.removeEventListener('ritsi:session-expired', handleExpiredSession);
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
    } catch (error) {
      if (error.response?.status === 401) {
        setUser(null);
        return;
      }
      toast.error(error.response?.data?.detail || 'No se pudo cerrar la sesión en el servidor. Inténtalo de nuevo.');
    }
  };

  if (loading) return <div className="app-loading"><span className="loader" /><p>Cargando la plataforma…</p></div>;

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-certificate/:code" element={<VerifyCertificate />} />
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing onAuthenticated={setUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/" replace />} />
        <Route path="/content/:contentId" element={user ? <ContentViewer user={user} onLogout={logout} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
