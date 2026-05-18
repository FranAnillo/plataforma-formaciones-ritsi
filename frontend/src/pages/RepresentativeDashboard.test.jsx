import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RepresentativeDashboard from './RepresentativeDashboard';
import { fetchAllData } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({ fetchAllData: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('../components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));

describe('RepresentativeDashboard', () => {
  const user = { name: 'Rep', user_type: 'representante' };
  const contents = [
    { id: 'public', title: 'Curso público', description: 'desc', is_public: true, files: [{ id: 'f' }], quizzes: [{ id: 'q' }] },
    { id: 'private', title: 'Curso privado', description: '', is_public: false, files: [], quizzes: [] },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('renders progress and filters content by public flag and search', async () => {
    fetchAllData.mockResolvedValue([
      { data: contents },
      { data: [{ content_id: 'public', files_completed: ['f'], quizzes_completed: { q: { passed: true } }, completed: true }] },
    ]);
    render(<MemoryRouter><RepresentativeDashboard user={user} onLogout={jest.fn()} /></MemoryRouter>);
    expect(await screen.findByText('Curso público')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Mostrar solo contenido público'));
    expect(screen.queryByText('Curso privado')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Buscar por título...'), { target: { value: 'ausente' } });
    expect(screen.getByText('No se encontraron formaciones con ese título')).toBeInTheDocument();
  });

  it('reports loading failures', async () => {
    fetchAllData.mockRejectedValue(new Error('offline'));
    render(<MemoryRouter><RepresentativeDashboard user={user} onLogout={jest.fn()} /></MemoryRouter>);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar datos'));
  });
});
