import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JuntaDashboard from './JuntaDashboard';
import UniversityDashboard from './UniversityDashboard';
import CoordinadorTematicoDashboard from './CoordinadorTematicoDashboard';
import { api, fetchAllData } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({
  api: { post: jest.fn() },
  fetchAllData: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));
jest.mock('../components/ui/dialog', () => ({
  Dialog: ({ children }) => <>{children}</>,
  DialogContent: ({ children }) => <>{children}</>,
  DialogHeader: ({ children }) => <>{children}</>,
  DialogTitle: ({ children }) => <>{children}</>,
  DialogTrigger: ({ children }) => <>{children}</>,
}));
jest.mock('../components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }) => (
    <input type="checkbox" id={id} checked={Boolean(checked)} onChange={(event) => onCheckedChange(event.target.checked)} />
  ),
}));

const rep = { id: 'rep', name: 'Rep', email: 'rep@example.com', user_type: 'representante' };
const content = { id: 'content', title: 'Curso', description: 'desc', status: 'published', files: [], quizzes: [] };

describe('assignment dashboards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.post.mockResolvedValue({});
  });

  it('lets Junta assign content to all representatives', async () => {
    fetchAllData.mockResolvedValue([{ data: [rep] }, { data: [content] }]);
    render(<JuntaDashboard user={{ name: 'Junta', user_type: 'junta_directiva' }} onLogout={jest.fn()} />);
    await screen.findByRole('heading', { name: 'Junta Directiva' });
    fireEvent.click(screen.getByTestId('confirm-assign-all-button'));
    expect(toast.error).toHaveBeenCalledWith('Selecciona un contenido');
    fireEvent.click(screen.getByLabelText(/Curso/));
    fireEvent.click(screen.getByTestId('confirm-assign-all-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', {
      content_id: 'content',
      assign_to_all_representatives: true,
    }));
  });

  it('lets universities assign only after selecting content and users', async () => {
    fetchAllData.mockResolvedValue([{ data: [rep] }, { data: [content] }]);
    render(<UniversityDashboard user={{ name: 'Uni', user_type: 'universidad' }} onLogout={jest.fn()} />);
    await screen.findByText('Gestión de Representantes');
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    expect(toast.error).toHaveBeenCalledWith('Selecciona contenido y al menos un representante');
    fireEvent.click(screen.getByLabelText('Curso'));
    fireEvent.click(screen.getByLabelText(/Rep/));
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', {
      content_id: 'content',
      user_ids: ['rep'],
    }));
  });

  it('shows only own vocalías and assigns published content', async () => {
    fetchAllData.mockResolvedValue([
      { data: [rep] },
      { data: [content, { ...content, id: 'draft', title: 'Borrador', status: 'pending' }] },
      { data: [{ id: 'mine', name: 'Mi vocalía', coordinator_id: 'coord' }, { id: 'other', name: 'Otra', coordinator_id: 'other' }] },
    ]);
    render(<CoordinadorTematicoDashboard user={{ id: 'coord', name: 'Coord', user_type: 'coordinador_tematico' }} onLogout={jest.fn()} />);
    expect(await screen.findByText('Mi vocalía')).toBeInTheDocument();
    expect(screen.queryByText('Otra')).not.toBeInTheDocument();
    expect(screen.queryByText('Borrador')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByText('Asignar Formación').at(-1));
    expect(toast.error).toHaveBeenCalledWith('Selecciona un contenido y al menos un representante');
    fireEvent.click(screen.getByLabelText('Curso'));
    fireEvent.click(screen.getByLabelText('Rep'));
    fireEvent.click(screen.getAllByText('Asignar Formación').at(-1));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', {
      content_id: 'content',
      user_ids: ['rep'],
    }));
  });
});
