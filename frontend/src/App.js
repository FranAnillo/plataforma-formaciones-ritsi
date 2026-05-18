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
import LoadingSpinner from './components/LoadingSpinner';
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

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
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
    return <LoadingSpinner />;
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
            return Dashboard ? <Dashboard user={user} onLogout={handleLogout} /> : <Landing />;
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
