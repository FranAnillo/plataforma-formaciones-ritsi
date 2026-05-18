import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdminDashboard from './AdminDashboard';
import { api, fetchAllData } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({
  api: { post: jest.fn(), put: jest.fn(), delete: jest.fn() },
  fetchAllData: jest.fn(),
}));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn() } }));
jest.mock('../components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));
jest.mock('./EscuelaFormacionDashboard', () => () => <div>escuela embebida</div>);
jest.mock('../components/ui/dialog', () => ({
  Dialog: ({ children }) => <>{children}</>,
  DialogContent: ({ children }) => <>{children}</>,
  DialogHeader: ({ children }) => <>{children}</>,
  DialogTitle: ({ children }) => <>{children}</>,
}));
jest.mock('../components/ui/tabs', () => ({
  Tabs: ({ children }) => <>{children}</>,
  TabsList: ({ children }) => <>{children}</>,
  TabsTrigger: ({ children, value }) => <button>{children}</button>,
  TabsContent: ({ children }) => <>{children}</>,
}));
jest.mock('../components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: ({ children }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));
jest.mock('../components/ui/switch', () => ({
  Switch: ({ checked, onCheckedChange }) => <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />,
}));
jest.mock('../components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }) => <>{children}</>,
  DropdownMenuContent: ({ children }) => <>{children}</>,
  DropdownMenuItem: ({ children, onClick }) => <button onClick={onClick}>{children}</button>,
}));

const data = {
  users: [
    { id: 'rep', name: 'Rep', email: 'rep@example.com', user_type: 'representante', university_id: 'uni', is_active: true },
    { id: 'coord', name: 'Coord', email: 'coord@example.com', user_type: 'coordinador_tematico', is_active: true },
  ],
  universities: [{ id: 'uni', name: 'Universidad', zone: 'I', is_active: true }],
  contents: [{ id: 'content', title: 'Curso', status: 'published', is_public: true }],
  assignments: [{ id: 'a', content_id: 'content', assigned_to_user_ids: ['rep'] }],
  commissions: [{ id: 'v', name: 'Vocalía', coordinator_id: 'coord' }],
  logs: [{ id: 'l', timestamp: '2026-01-01T10:00:00Z', actor_name: 'Admin', action: 'Cambio', target_user_name: 'Rep', details: { status: 'activado' } }],
};

function rowForText(text) {
  return screen
    .getAllByText(text)
    .map((element) => element.closest('tr'))
    .find((row) => row?.querySelector('td'));
}

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    URL.createObjectURL = jest.fn(() => 'blob:url');
    fetchAllData.mockResolvedValue([
      { data: data.users },
      { data: data.universities },
      { data: data.contents },
      { data: data.assignments },
      { data: data.commissions },
      { data: data.logs },
    ]);
    api.post.mockResolvedValue({ data: { message: 'ok' } });
    api.put.mockResolvedValue({});
    api.delete.mockResolvedValue({});
  });

  it('renders management data and exercises admin mutations', async () => {
    render(<AdminDashboard user={{ name: 'Admin', user_type: 'admin' }} onLogout={jest.fn()} />);
    expect(await screen.findByText('Panel de Administración')).toBeInTheDocument();
    expect(screen.getByText('Usuarios totales')).toBeInTheDocument();
    expect(screen.getAllByText('Universidad').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Vocalía').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Ver Formaciones')[0]);
    fireEvent.click(screen.getByText('Retirar'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments/unassign', { user_id: 'rep', content_id: 'content' }));

    fireEvent.click(screen.getByText('Crear Vocalía'));
    expect(toast.error).toHaveBeenCalledWith('El nombre de la vocalía es obligatorio.');
    fireEvent.change(screen.getByLabelText('Nombre de la Vocalía'), { target: { value: 'Nueva vocalía' } });
    fireEvent.click(screen.getByText('Crear Vocalía'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/vocalias', expect.objectContaining({ name: 'Nueva vocalía' })));

    fireEvent.click(screen.getByText('Crear Universidad'));
    expect(toast.error).toHaveBeenCalledWith('El nombre de la universidad es obligatorio.');
    fireEvent.change(screen.getByLabelText('Nombre de la Universidad'), { target: { value: 'Nueva universidad' } });
    fireEvent.click(screen.getByText('Crear Universidad'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/universities', expect.objectContaining({ name: 'Nueva universidad' })));

    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    await waitFor(() => expect(api.delete).toHaveBeenCalled());
  });

  it('handles user mutations plus CSV import/export paths', async () => {
    const originalReader = global.FileReader;
    global.FileReader = class {
      readAsText() {
        this.onload({
          target: {
            result: 'email,name,user_type,university_id\nnuevo@example.com,Nuevo,representante,uni\n',
          },
        });
      }
    };
    api.post.mockResolvedValue({ data: { created: 1, skipped: 0, errors: [] } });

    render(<AdminDashboard user={{ name: 'Admin', user_type: 'admin' }} onLogout={jest.fn()} />);
    await screen.findByText('Panel de Administración');

    fireEvent.change(screen.getAllByRole('combobox').find((select) => select.value === 'representante'), { target: { value: 'admin' } });
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/users/rep/role', { user_type: 'admin' });
      expect(api.put).toHaveBeenCalledWith('/users/rep/status', { is_active: false });
    });

    fireEvent.click(screen.getByText(/Exportar/));
    expect(URL.createObjectURL).toHaveBeenCalled();
    fireEvent.click(screen.getByText(/Importar/));
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(['csv'], 'users.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/users/import', {
      users: [{ email: 'nuevo@example.com', name: 'Nuevo', user_type: 'representante', university_id: 'uni' }],
    }));
    expect(toast.success).toHaveBeenCalledWith('Importación completada: 1 usuarios creados, 0 omitidos.');
    global.FileReader = originalReader;
  });

  it('covers sorting, stat shortcuts, edits, zone assignment and richer activity details', async () => {
    fetchAllData.mockResolvedValue([
      { data: data.users },
      { data: [...data.universities, { id: 'uni-2', name: 'Aulario', zone: 'I', is_active: false }] },
      { data: [...data.contents, { id: 'pending', title: 'Pendiente', status: 'pending', is_public: false }] },
      { data: [...data.assignments, { id: 'all', content_id: 'content', assigned_to_all_representatives: true }] },
      { data: [...data.commissions, { id: 'v-2', name: 'Actas', coordinator_id: null }] },
      { data: [
        ...data.logs,
        {
          id: 'rich',
          timestamp: '2026-01-02T10:00:00Z',
          actor_name: 'Admin',
          action: 'Rol',
          target_user_name: 'Coord',
          details: {
            from: 'representante',
            to: 'admin',
            commission_name: 'Vocalía',
            added: ['Rep'],
            removed: ['Coord'],
          },
        },
      ] },
    ]);
    api.post.mockResolvedValue({ data: { message: 'Zona asignada' } });

    render(<AdminDashboard user={{ name: 'Admin', user_type: 'admin' }} onLogout={jest.fn()} />);
    await screen.findByText('Panel de Administración');
    fireEvent.keyDown(screen.getByText('Usuarios totales').closest('[role="button"]'), { key: 'Enter' });
    fireEvent.click(screen.getByText('Pendientes').closest('[role="button"]'));
    fireEvent.click(screen.getByText('Públicos').closest('[role="button"]'));
    fireEvent.click(screen.getAllByText('Universidad')[0]);
    fireEvent.click(screen.getByText('Zona'));
    fireEvent.click(screen.getAllByText('Vocalía')[0]);

    fireEvent.click(screen.getAllByText('Recomendar Formación')[0]);
    fireEvent.change(screen.getAllByRole('combobox').find((select) => [...select.options].some((option) => option.text === 'Curso')), { target: { value: 'content' } });
    fireEvent.click(screen.getByText('Asignar a Zona'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments/zone', { zone: 'I', content_id: 'content' }));

    fireEvent.click(screen.getAllByText('Editar')[0]);
    fireEvent.change(screen.getByLabelText('Nombre de la Universidad'), { target: { value: 'Universidad editada' } });
    fireEvent.click(screen.getByText('Guardar Cambios'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/universities/uni-2', expect.objectContaining({ name: 'Universidad editada' })));

    fireEvent.click(screen.getAllByRole('checkbox').at(-1));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/universities/uni/status', { is_active: false }));
    expect(screen.getByText(/Añadidos: Rep/)).toBeInTheDocument();
    expect(screen.getByText(/Eliminados: Coord/)).toBeInTheDocument();
  });

  it('shows load and mutation failures', async () => {
    fetchAllData.mockRejectedValueOnce(new Error('offline'));
    render(<AdminDashboard user={{ name: 'Admin', user_type: 'admin' }} onLogout={jest.fn()} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar estadísticas'));
  });

  it('covers secondary admin CRUD, filters, warning imports and API errors', async () => {
    const originalReader = global.FileReader;
    global.FileReader = class {
      readAsText() {
        this.onload({
          target: {
            result: 'email,name,user_type,university_id\nfallo@example.com,Fallo,representante,\n',
          },
        });
      }
    };
    api.post.mockResolvedValue({ data: { created: 0, skipped: 1, errors: ['duplicado'] } });

    render(<AdminDashboard user={{ name: 'Admin', user_type: 'admin' }} onLogout={jest.fn()} />);
    await screen.findByText('Panel de Administración');

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email...'), { target: { value: 'rep' } });
    fireEvent.click(screen.getByText('Representantes').closest('[role="button"]'));
    fireEvent.click(screen.getByText('Formadores').closest('[role="button"]'));
    fireEvent.click(screen.getAllByText('Vocalías').find((element) => element.closest('[role="button"]')).closest('[role="button"]'));
    fireEvent.click(screen.getByText('Inactivos').closest('[role="button"]'));
    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [new File(['csv'], 'users.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      'Importación completada: 0 usuarios creados, 1 omitidos. Errores: duplicado',
      { duration: 10000 }
    ));

    fireEvent.click(screen.getByText('Editar Vocalía'));
    fireEvent.change(screen.getByLabelText('Nombre de la Vocalía'), { target: { value: 'Vocalía editada' } });
    fireEvent.click(screen.getByText('Guardar Cambios'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/vocalias/v', expect.objectContaining({ name: 'Vocalía editada' })));
    fireEvent.click(within(rowForText('Vocalía')).getByText('Eliminar'));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/vocalias/v'));

    api.post.mockRejectedValueOnce({ response: { data: { detail: 'fallo retirada' } } });
    fireEvent.click(screen.getByText('Usuarios totales').closest('[role="button"]'));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre o email...'), { target: { value: '' } });
    fireEvent.click(screen.getAllByText('Ver Formaciones')[0]);
    fireEvent.click(screen.getByText('Retirar'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo retirada'));

    api.put.mockRejectedValueOnce({ response: { data: { detail: 'fallo rol' } } });
    fireEvent.change(screen.getAllByRole('combobox').find((select) => select.value === 'representante'), { target: { value: 'admin' } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo rol'));

    api.delete.mockRejectedValueOnce({ response: { data: { detail: 'fallo universidad' } } });
    const universityRow = screen
      .getAllByText('Universidad')
      .find((element) => element.tagName === 'TD' && element.className.includes('font-medium'))
      .closest('tr');
    fireEvent.click(within(universityRow).getByText('Eliminar'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo universidad'));
    global.FileReader = originalReader;
  });
});
