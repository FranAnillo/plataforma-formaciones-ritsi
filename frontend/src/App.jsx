import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import ContentViewer from './pages/ContentViewer';
import api from './services/api';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then(({ data }) => setUser(data)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => null);
    setUser(null);
  };

  if (loading) return <div className="app-loading"><span className="loader" /><p>Cargando la plataforma…</p></div>;

  return (
    <BrowserRouter>
      <Toaster position="top-right" richColors />
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing onAuthenticated={setUser} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} onLogout={logout} /> : <Navigate to="/" replace />} />
        <Route path="/content/:contentId" element={user ? <ContentViewer user={user} onLogout={logout} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
