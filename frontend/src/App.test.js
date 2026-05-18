import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { api } from './services/api';

jest.mock('./services/api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('./pages/Landing', () => () => <div>landing</div>);
jest.mock('./pages/Register', () => ({ onComplete }) => <button onClick={onComplete}>register</button>);
jest.mock('./pages/RepresentativeDashboard', () => ({ onLogout }) => <button onClick={onLogout}>representante</button>);
jest.mock('./pages/UniversityDashboard', () => () => <div>universidad</div>);
jest.mock('./pages/JuntaDashboard', () => () => <div>junta</div>);
jest.mock('./pages/EscuelaFormacionDashboard', () => () => <div>escuela</div>);
jest.mock('./pages/AdminDashboard', () => () => <div>admin</div>);
jest.mock('./pages/CoordinadorTematicoDashboard', () => () => <div>vocalia</div>);
jest.mock('./pages/ContentViewer', () => () => <div>content</div>);
jest.mock('./components/ui/sonner', () => ({ Toaster: () => null }));

describe('App routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('keeps unauthenticated users on the public landing', async () => {
    api.get.mockRejectedValue(new Error('401'));
    render(<App />);
    expect(await screen.findByText('landing')).toBeInTheDocument();
  });

  it('routes incomplete users through registration', async () => {
    api.get.mockResolvedValue({ data: { email: 'a@example.com', name: 'A', user_type: 'representante', university_id: null } });
    render(<App />);
    expect(await screen.findByText('register')).toBeInTheDocument();
  });

  it('routes registered users to dashboards and logs them out', async () => {
    api.get.mockResolvedValue({ data: { email: 'a@example.com', name: 'A', user_type: 'representante', university_id: 'uni' } });
    api.post.mockResolvedValue({});
    render(<App />);
    fireEvent.click(await screen.findByText('representante'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/logout'));
    expect(await screen.findByText('landing')).toBeInTheDocument();
  });

  it('redirects unknown roles back to landing and protects content routes', async () => {
    api.get.mockResolvedValue({ data: { email: 'a@example.com', name: 'A', user_type: 'desconocido', university_id: 'uni' } });
    render(<App />);
    expect(await screen.findByText('landing')).toBeInTheDocument();
  });

  it('logs logout failures without breaking the dashboard', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    api.get.mockResolvedValue({ data: { email: 'a@example.com', name: 'A', user_type: 'representante', university_id: 'uni' } });
    api.post.mockRejectedValue(new Error('offline'));
    render(<App />);
    fireEvent.click(await screen.findByText('representante'));
    await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Error cerrando sesión:', expect.any(Error)));
    expect(screen.getByText('representante')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
