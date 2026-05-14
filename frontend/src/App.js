import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import Register from './pages/Register';
import RepresentativeDashboard from './pages/RepresentativeDashboard';
import UniversityDashboard from './pages/UniversityDashboard';
import JuntaDashboard from './pages/JuntaDashboard';
import EscuelaFormacionDashboard from './pages/EscuelaFormacionDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CoordinadorTematicoDashboard from './pages/CoordinadorTematicoDashboard';
import ContentViewer from './pages/ContentViewer';
import { Toaster } from './components/ui/sonner';
import { api } from './services/api';
import '@/App.css';

const dashboardComponents = {
  representante: RepresentativeDashboard,
  colaboracion_externa: RepresentativeDashboard,
  universidad: UniversityDashboard,
  junta_directiva: JuntaDashboard,
  escuela_formacion: EscuelaFormacionDashboard,
  coordinador_tematico: CoordinadorTematicoDashboard,
  formador: EscuelaFormacionDashboard,
  admin: AdminDashboard,
};

const getSessionIdFromUrl = () => {
  const searchSessionId = new URLSearchParams(window.location.search).get('session_id');
  if (searchSessionId) return searchSessionId;

  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const hashQuery = hash.includes('?') ? hash.split('?')[1] : hash;
  return new URLSearchParams(hashQuery).get('session_id');
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const sessionId = getSessionIdFromUrl();
    if (sessionId) {
      await processSessionId(sessionId);
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check existing session
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      
      // Check if needs registration
      if (!response.data.university_id) {
        setNeedsRegistration(true);
      }
    } catch (error) {
      // No active session: keep the public landing page.
    } finally {
      setLoading(false);
    }
  };

  const processSessionId = async (sessionId) => {
    try {
      const response = await api.get('/auth/session', {
        params: { session_id: sessionId },
      });

      setNeedsRegistration(Boolean(response.data.needs_registration));

      if (response.data.user) {
        setUser(response.data.user);
      } else {
        const userResponse = await api.get('/auth/me');
        setUser(userResponse.data);
      }
    } catch (error) {
      console.error('Error procesando sesión:', error);
      setUser(null);
      setNeedsRegistration(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      setUser(null);
      setNeedsRegistration(false);
    } catch (error) {
      console.error('Error cerrando sesión:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={
          user ? (
            needsRegistration ? (
              <Navigate to="/register" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Landing />
          )
        } />
        
        <Route path="/register" element={
          user && needsRegistration ? (
            <Register user={user} onComplete={() => {
              setNeedsRegistration(false);
              window.location.href = '/dashboard';
            }} />
          ) : (
            <Navigate to="/" replace />
          )
        } />
        
        <Route path="/dashboard" element={
          user && !needsRegistration ? (() => {
            const Dashboard = dashboardComponents[user.user_type];
            return Dashboard ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/" replace />;
          })() : (
            <Navigate to="/" replace />
          )
        } />
        
        <Route path="/content/:contentId" element={
          user && !needsRegistration ? (
            <ContentViewer user={user} onLogout={handleLogout} />
          ) : (
            <Navigate to="/" replace />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
