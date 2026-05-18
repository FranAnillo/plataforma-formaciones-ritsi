import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EscuelaFormacionDashboard from './EscuelaFormacionDashboard';
import { api, fetchAllData } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({
  api: { post: jest.fn(), put: jest.fn(), delete: jest.fn() },
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
jest.mock('../components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) => <select value={value} onChange={(event) => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: ({ children }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));
jest.mock('../components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange = () => {} }) => (
    <input type="checkbox" id={id} checked={Boolean(checked)} onChange={(event) => onCheckedChange(event.target.checked)} />
  ),
}));

const representative = { id: 'rep', name: 'Rep', email: 'rep@example.com' };
const category = { id: 'cat', name: 'Seguridad' };
const pending = { id: 'pending', title: 'Pendiente', description: 'desc', status: 'pending', is_public: false, files: [], quizzes: [], category_ids: ['cat'] };

function renderDashboard(props = {}) {
  return render(
    <MemoryRouter>
      <EscuelaFormacionDashboard user={{ id: 'school', name: 'Escuela', user_type: 'escuela_formacion' }} onLogout={jest.fn()} {...props} />
    </MemoryRouter>
  );
}

function fillFirstFile({ title = 'PDF', url = 'url' } = {}) {
  fireEvent.change(screen.getByPlaceholderText('Título del archivo'), { target: { value: title } });
  fireEvent.change(screen.getByPlaceholderText('URL de Google Drive (compartido)'), { target: { value: url } });
}

describe('EscuelaFormacionDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchAllData.mockResolvedValue([{ data: [pending] }, { data: [representative] }, { data: [category] }]);
    api.post.mockResolvedValue({ data: category });
    api.put.mockResolvedValue({ data: { ...category, name: 'Actualizada' } });
    api.delete.mockResolvedValue({});
  });

  it('validates creation and assignment flows, then moderates content', async () => {
    renderDashboard();
    expect(await screen.findByRole('heading', { name: 'Pendiente' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('El título es obligatorio');

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Curso' } });
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('Agrega al menos un archivo');
    fireEvent.click(screen.getByText('Agregar Archivo'));
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('Completa todos los campos de los archivos');

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes.find((input) => input.placeholder === 'Título del archivo'), { target: { value: 'PDF' } });
    fireEvent.change(textboxes.find((input) => input.placeholder === 'URL de Google Drive (compartido)'), { target: { value: 'url' } });
    fireEvent.click(screen.getByTestId('submit-content-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/content', expect.objectContaining({ title: 'Curso' })));

    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    expect(toast.error).toHaveBeenCalledWith('Selecciona un contenido');
    fireEvent.click(screen.getAllByLabelText(/Pendiente/)[0]);
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    expect(toast.error).toHaveBeenCalledWith('Selecciona al menos un usuario o marca "Asignar a todos"');
    fireEvent.click(screen.getByLabelText(/Rep/));
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', expect.objectContaining({ content_id: 'pending' })));

    fireEvent.click(screen.getByText('Aprobar'));
    fireEvent.click(screen.getByText('Rechazar'));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/content/pending/approve');
      expect(api.post).toHaveBeenCalledWith('/content/pending/reject');
    });
  });

  it('supports formador data shape and category validation', async () => {
    fetchAllData.mockResolvedValue([{ data: [] }, { data: [category] }]);
    render(
      <MemoryRouter>
        <EscuelaFormacionDashboard user={{ id: 'f', name: 'F', user_type: 'formador' }} onLogout={jest.fn()} initialFilter={{ is_public: true }} />
      </MemoryRouter>
    );
    await screen.findByText('Panel de Persona Formadora');
    expect(screen.queryByText('Asignar Contenido')).not.toBeInTheDocument();
  });

  it('covers quiz building, category lifecycle, file sorting and assignment to all', async () => {
    api.post.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/categories' ? { id: 'new-cat', name: 'Nueva' } : category,
    }));
    const { container } = renderDashboard();
    await screen.findByRole('heading', { name: 'Pendiente' });

    fireEvent.click(screen.getByText('Crear'));
    expect(toast.error).toHaveBeenCalledWith('El nombre de la categoría no puede estar vacío');
    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva categoría'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByText('Crear'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/categories', { name: 'Nueva' }));

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Curso con quiz' } });
    fireEvent.click(screen.getByText('Agregar Archivo'));
    fireEvent.click(screen.getByText('Agregar Archivo'));
    const fileCards = container.querySelectorAll('[draggable="true"]');
    fireEvent.dragStart(fileCards[0]);
    fireEvent.dragEnter(fileCards[1]);
    fireEvent.dragEnd(fileCards[0]);
    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    fillFirstFile();
    fireEvent.change(screen.getAllByRole('combobox').find((select) => select.value === 'video'), { target: { value: 'pdf' } });

    fireEvent.click(screen.getByText('Agregar Cuestionario'));
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('Completa todos los títulos de los cuestionarios');
    fireEvent.change(screen.getByPlaceholderText('Título del cuestionario'), { target: { value: 'Quiz seguro' } });
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('El cuestionario "Quiz seguro" debe tener al menos una pregunta');
    fireEvent.click(screen.getByText('Agregar Pregunta'));
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('Completa todas las preguntas');
    fireEvent.change(screen.getByPlaceholderText('Texto de la pregunta'), { target: { value: '¿Es correcto?' } });
    fireEvent.click(screen.getByTestId('submit-content-button'));
    expect(toast.error).toHaveBeenCalledWith('La pregunta "¿Es correcto?" debe tener al menos una respuesta correcta');

    fireEvent.change(screen.getAllByRole('combobox').find((select) => select.value === 'true_false'), { target: { value: 'multiple_response' } });
    ['Uno', 'Dos', 'Tres', 'Cuatro'].forEach((value, index) => {
      fireEvent.change(screen.getByPlaceholderText(`Opción ${index + 1}`), { target: { value } });
    });
    const answerCheckboxes = screen.getAllByRole('checkbox').slice(-4);
    fireEvent.click(answerCheckboxes[0]);
    fireEvent.click(answerCheckboxes[1]);
    fireEvent.click(answerCheckboxes[0]);
    fireEvent.click(screen.getByTestId('submit-content-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/content', expect.objectContaining({
      title: 'Curso con quiz',
      quizzes: [expect.objectContaining({ title: 'Quiz seguro' })],
    })));

    fireEvent.click(screen.getAllByLabelText(/Pendiente/)[0]);
    fireEvent.click(screen.getByLabelText('Asignar a todos los representantes'));
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assignments', {
      content_id: 'pending',
      user_ids: undefined,
      assign_to_all_representatives: true,
    }));

    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Guardar Cambios'));
    expect(toast.error).toHaveBeenCalledWith('El nombre no puede estar vacío');
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Actualizada' } });
    fireEvent.click(screen.getByText('Guardar Cambios'));
    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/categories/cat', { name: 'Actualizada' }));

    const updatedCategoryRow = screen
      .getAllByText('Actualizada')
      .find((element) => element.tagName === 'SPAN' && element.className === 'font-medium')
      .parentElement;
    fireEvent.click(updatedCategoryRow.querySelectorAll('button')[1]);
    fireEvent.click(screen.getAllByText('Eliminar').at(-1));
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith('/categories/cat'));
  });

  it('surfaces API failures and supports empty filtered states', async () => {
    const published = { ...pending, id: 'published', title: 'Publicado', status: 'published', is_public: true, category_ids: [] };
    fetchAllData.mockResolvedValue([{ data: [published] }, { data: [representative] }, { data: [category] }]);
    api.post.mockRejectedValue({ response: { data: { detail: 'fallo post' } } });
    api.delete.mockRejectedValue({ response: { data: { detail: 'fallo delete' } } });
    renderDashboard({ initialFilter: { is_public: false, status: 'pending' } });
    await screen.findByText('No hay contenidos que coincidan con los filtros actuales.');

    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva categoría'), { target: { value: 'Nueva' } });
    fireEvent.click(screen.getByText('Crear'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo post'));

    fireEvent.click(screen.getAllByText('Eliminar')[0]);
    fireEvent.click(screen.getAllByText('Eliminar').at(-1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo delete'));
  });

  it('reports fetch failures', async () => {
    fetchAllData.mockRejectedValue(new Error('offline'));
    renderDashboard();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar datos'));
    expect(screen.getByText('No hay contenidos creados aún.')).toBeInTheDocument();
  });

  it('surfaces content mutation failures and lets users remove builder blocks', async () => {
    api.post.mockImplementation((endpoint) => {
      const detail = endpoint === '/content'
        ? 'fallo crear'
        : endpoint === '/assignments'
        ? 'fallo asignar'
        : endpoint.endsWith('/approve')
        ? 'fallo aprobar'
        : 'fallo rechazar';
      return Promise.reject({ response: { data: { detail } } });
    });
    api.delete.mockRejectedValue({ response: { data: { detail: 'fallo borrar contenido' } } });
    renderDashboard();
    await screen.findByRole('heading', { name: 'Pendiente' });

    fireEvent.change(screen.getByLabelText('Título *'), { target: { value: 'Curso' } });
    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'desc' } });
    fireEvent.click(screen.getByLabelText('Marcar como contenido público (visible para todos)'));
    fireEvent.click(screen.getByText('Agregar Archivo'));
    fillFirstFile();
    fireEvent.click(screen.getByTestId('submit-content-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo crear'));

    fireEvent.click(screen.getByText('Agregar Cuestionario'));
    fireEvent.click(screen.getByText('Agregar Pregunta'));
    fireEvent.click(screen.getByText('Pregunta 1').parentElement.querySelector('button'));
    fireEvent.click(screen.getByText('Cuestionario 1').closest('[draggable="true"]').querySelector('button'));

    fireEvent.click(screen.getAllByLabelText(/Pendiente/)[0]);
    fireEvent.click(screen.getByLabelText('Asignar a todos los representantes'));
    fireEvent.click(screen.getByTestId('confirm-assign-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo asignar'));

    fireEvent.click(screen.getByText('Aprobar'));
    fireEvent.click(screen.getByText('Rechazar'));
    fireEvent.click(screen.getByText('Vista previa'));
    fireEvent.click(screen.getByText('Vista previa').parentElement.querySelectorAll('button')[3]);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('fallo aprobar');
      expect(toast.error).toHaveBeenCalledWith('fallo rechazar');
      expect(toast.error).toHaveBeenCalledWith('fallo borrar contenido');
    });
  });

  it('surfaces category update and delete failures', async () => {
    api.put.mockRejectedValue({ response: { data: { detail: 'fallo categoría' } } });
    api.delete.mockRejectedValue({ response: { data: { detail: 'fallo eliminar categoría' } } });
    renderDashboard();
    await screen.findByRole('heading', { name: 'Pendiente' });

    fireEvent.click(screen.getByText('Editar'));
    fireEvent.change(screen.getByLabelText('Nombre de la categoría'), { target: { value: 'Actualizada' } });
    fireEvent.click(screen.getByText('Guardar Cambios'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo categoría'));

    const categoryRow = screen
      .getAllByText('Seguridad')
      .find((element) => element.tagName === 'SPAN' && element.className === 'font-medium')
      .parentElement;
    fireEvent.click(categoryRow.querySelectorAll('button')[1]);
    fireEvent.click(screen.getAllByText('Eliminar').at(-1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('fallo eliminar categoría'));
  });
});
