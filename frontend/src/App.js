import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { authService } from './services/api';
import Landing from './pages/Landing';
import Register from './pages/Register';
import RepresentativeDashboard from './pages/RepresentativeDashboard';
import UniversityDashboard from './pages/UniversityDashboard';
import JuntaDashboard from './pages/JuntaDashboard';
import EscuelaFormacionDashboard from './pages/EscuelaFormacionDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ContentViewer from './pages/ContentViewer';
import LoadingSpinner from './components/LoadingSpinner';
import { Toaster } from './components/ui/sonner';
import '@/App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    // Check for session_id in URL fragment
    const fragment = window.location.hash;
    if (fragment && fragment.includes('session_id=')) {
      const sessionId = fragment.split('session_id=')[1].split('&')[0];
      await processSessionId(sessionId);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    // Check existing session
    try {
      const userData = await authService.getMe();
      setUser(userData);
      
      // Check if needs registration
      if (!userData.university_id) {
        setNeedsRegistration(true);
      }
    } catch (error) {
      console.log('No hay sesión activa');
    } finally {
      setLoading(false);
    }
  };

  const processSessionId = async (sessionId) => {
    try {
      const response = await authService.processSession(sessionId);
      
      if (response.needs_registration) {
        setNeedsRegistration(true);
      }
      
      // Get user data
      const userData = await authService.getMe();
      setUser(userData);
    } catch (error) {
      console.error('Error procesando sesión:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
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
          user && !needsRegistration ? (
            user.user_type === 'representante' ? (
              <RepresentativeDashboard user={user} onLogout={handleLogout} />
            ) : user.user_type === 'universidad' ? (
              <UniversityDashboard user={user} onLogout={handleLogout} />
            ) : user.user_type === 'junta_directiva' ? (
              <JuntaDashboard user={user} onLogout={handleLogout} />
            ) : user.user_type === 'escuela_formacion' ? (
              <EscuelaFormacionDashboard user={user} onLogout={handleLogout} />
            ) : user.user_type === 'admin' ? (
              <AdminDashboard user={user} onLogout={handleLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          ) : (
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