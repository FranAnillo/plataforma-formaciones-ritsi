import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ContentViewer from './ContentViewer';
import { api } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), info: jest.fn() } }));
jest.mock('../components/ThemeToggleButton', () => ({ ThemeToggleButton: () => null }));
jest.mock('../components/ui/radio-group', () => ({
  RadioGroup: ({ children, onValueChange }) => <div onChange={(event) => onValueChange(event.target.value)}>{children}</div>,
  RadioGroupItem: ({ value, id }) => <input type="radio" value={value} id={id} />,
}));
jest.mock('../components/ui/checkbox', () => ({
  Checkbox: ({ id, checked, onCheckedChange }) => (
    <input type="checkbox" id={id} checked={Boolean(checked)} onChange={(event) => onCheckedChange(event.target.checked)} />
  ),
}));

const file = {
  id: 'file-1',
  file_type: 'pdf',
  google_drive_url: 'https://drive.google.com/file/d/pdf-id/view',
  title: 'PDF',
};
const quiz = {
  id: 'quiz-1',
  title: 'Quiz',
  passing_percentage: 70,
  questions: [
    { id: 'q1', question_text: 'Verdadero', question_type: 'true_false', options: ['Sí', 'No'] },
  ],
};

function renderViewer(initialEntry = '/content/course') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/content/:contentId" element={<ContentViewer user={{}} />} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ContentViewer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('marks files as completed', async () => {
    const content = { id: 'course', title: 'Curso', description: 'Desc', files: [file], quizzes: [quiz] };
    api.get.mockImplementation((endpoint) => {
      if (endpoint === '/content/course') return Promise.resolve({ data: content });
      return Promise.resolve({ data: [{ content_id: 'course', files_completed: [], quizzes_completed: {} }] });
    });
    api.post.mockImplementation((endpoint) => {
      if (endpoint === '/progress/file-completed') {
        api.get.mockImplementation((nextEndpoint) => {
          if (nextEndpoint === '/content/course') return Promise.resolve({ data: content });
          return Promise.resolve({ data: [{ content_id: 'course', files_completed: ['file-1'], quizzes_completed: {} }] });
        });
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });
    renderViewer();
    expect(await screen.findByText('Curso')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mark-file-completed-button'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/progress/file-completed', {
      content_id: 'course',
      file_id: 'file-1',
    }));
  });

  it('validates quizzes and submits successful answers', async () => {
    const content = { id: 'course', title: 'Curso', description: 'Desc', files: [file], quizzes: [quiz] };
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? content
        : [{ content_id: 'course', files_completed: ['file-1'], quizzes_completed: {} }],
    }));
    api.post.mockResolvedValue({ data: { passed: true, score: 100, attempts: 1 } });
    renderViewer();
    expect(await screen.findByTestId('submit-quiz-button')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('submit-quiz-button'));
    expect(toast.error).toHaveBeenCalledWith('Por favor responde todas las preguntas');
    fireEvent.click(screen.getByLabelText('Sí'));
    fireEvent.click(screen.getByTestId('submit-quiz-button'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('¡Aprobado! Puntuación: 100.0%'));
  });

  it('disables writes in preview mode and renders unsupported embeds', async () => {
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint.startsWith('/content')
        ? { id: 'course', title: 'Preview', files: [{ ...file, google_drive_url: 'bad-url' }], quizzes: [] }
        : [],
    }));
    renderViewer('/content/course?preview=true');
    expect(await screen.findByText('Vista previa')).toBeInTheDocument();
    expect(screen.getByText(/No se puede previsualizar/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mark-file-completed-button'));
    expect(toast.info).toHaveBeenCalled();
  });

  it('reports load failures and empty content', async () => {
    api.get.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: [] });
    renderViewer();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar contenido'));
    expect(screen.getByText('Contenido no encontrado')).toBeInTheDocument();
  });

  it('starts directly in quizzes when there are no files and handles failed attempts', async () => {
    const content = {
      id: 'course',
      title: 'Solo quiz',
      files: [],
      quizzes: [{
        id: 'quiz-1',
        title: 'Quiz mixto',
        passing_percentage: 70,
        questions: [
          { id: 'q1', question_text: 'Elige una', question_type: 'multiple_choice', options: ['A', 'B'] },
          { id: 'q2', question_text: 'Elige varias', question_type: 'multiple_response', options: ['X', 'Y'] },
        ],
      }],
    };
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? content
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    api.post.mockResolvedValue({ data: { passed: false, score: 40, attempts: 2 } });
    renderViewer();
    expect(await screen.findAllByText('Quiz mixto')).not.toHaveLength(0);
    fireEvent.click(screen.getByLabelText('A'));
    fireEvent.click(screen.getByLabelText('X'));
    fireEvent.click(screen.getByLabelText('Y'));
    fireEvent.click(screen.getByLabelText('X'));
    fireEvent.click(screen.getByTestId('submit-quiz-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      'No aprobado. Puntuación: 40.0%. Necesitas 70% para aprobar. Intento 2.',
      { duration: 5000 }
    ));
  });

  it('renders every supported embed family and empty resources', async () => {
    const content = {
      id: 'course',
      title: 'Embeds',
      files: [
        { id: 'video', file_type: 'video', google_drive_url: 'https://drive.google.com/file/d/video-id/view', title: 'Video' },
        { id: 'image', file_type: 'image', google_drive_url: 'https://drive.google.com/open?id=image-id', title: 'Imagen' },
        { id: 'slides', file_type: 'presentation', google_drive_url: 'https://docs.google.com/presentation/d/slides-id/edit', title: 'Slides' },
        { id: 'other', file_type: 'zip', google_drive_url: 'https://example.com/zip', title: 'Zip' },
      ],
      quizzes: [],
    };
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? content
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    renderViewer();
    expect(await screen.findByTitle('Video')).toHaveAttribute('src', expect.stringContaining('video-id'));
    fireEvent.click(screen.getByText('Imagen'));
    expect(screen.getByAltText('Imagen')).toHaveAttribute('src', expect.stringContaining('image-id'));
    fireEvent.click(screen.getByText('Slides'));
    expect(screen.getByTitle('Slides')).toHaveAttribute('src', expect.stringContaining('slides-id'));
    fireEvent.click(screen.getByText('Zip'));
    expect(screen.getByText(/No se puede previsualizar/)).toBeInTheDocument();

    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? { id: 'course', title: 'Vacío', files: [], quizzes: [] }
        : [],
    }));
    renderViewer();
    expect(await screen.findByText('Este contenido todavía no tiene recursos disponibles.')).toBeInTheDocument();
  });

  it('covers preview quiz blocking, locked quizzes and write failures', async () => {
    const content = { id: 'course', title: 'Curso', files: [file], quizzes: [quiz] };
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? content
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    api.post.mockRejectedValue(new Error('offline'));
    renderViewer();
    expect(await screen.findByText('Curso')).toBeInTheDocument();
    expect(screen.getByText('Quiz').closest('button')).toBeDisabled();
    fireEvent.click(screen.getByTestId('mark-file-completed-button'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al marcar como completado'));

    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? { ...content, title: 'Vista previa quiz', files: [] }
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    renderViewer('/content/course?preview=true');
    expect(await screen.findByText('Vista previa quiz')).toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('submit-quiz-button').at(-1));
    expect(toast.info).toHaveBeenCalledWith('El envío de cuestionarios está deshabilitado en el modo de vista previa.');
  });

  it('advances through files, handles submit failures and navigates after completion', async () => {
    const secondFile = { ...file, id: 'file-2', title: 'PDF 2' };
    const content = {
      id: 'course',
      title: 'Ruta completa',
      files: [file, secondFile],
      quizzes: [quiz],
    };
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? content
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    api.post.mockImplementation((endpoint) => {
      if (endpoint === '/progress/file-completed') {
        api.get.mockImplementation((nextEndpoint) => Promise.resolve({
          data: nextEndpoint === '/content/course'
            ? content
            : [{ content_id: 'course', files_completed: ['file-1'], quizzes_completed: {} }],
        }));
        return Promise.resolve({});
      }
      return Promise.reject(new Error('offline'));
    });
    renderViewer();
    await screen.findByText('Ruta completa');
    fireEvent.click(screen.getByTestId('mark-file-completed-button'));
    await waitFor(() => expect(screen.getAllByText('PDF 2').length).toBeGreaterThan(0));

    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? { ...content, files: [] }
        : [{ content_id: 'course', files_completed: [], quizzes_completed: {} }],
    }));
    renderViewer();
    await screen.findAllByTestId('submit-quiz-button');
    fireEvent.click(screen.getAllByLabelText('Sí').at(-1));
    fireEvent.click(screen.getAllByTestId('submit-quiz-button').at(-1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al enviar cuestionario'));

    api.post.mockResolvedValue({ data: { passed: true, score: 100, attempts: 1 } });
    api.get.mockImplementation((endpoint) => Promise.resolve({
      data: endpoint === '/content/course'
        ? { ...content, files: [] }
        : [{ content_id: 'course', files_completed: [], quizzes_completed: { 'quiz-1': { passed: true } }, completed: true }],
    }));
    renderViewer();
    await screen.findAllByTestId('submit-quiz-button');
    fireEvent.click(screen.getAllByLabelText('Sí').at(-1));
    fireEvent.click(screen.getAllByTestId('submit-quiz-button').at(-1));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      '¡Has completado todo el contenido formativo!',
      { duration: 5000 }
    ));
    fireEvent.click(screen.getAllByTestId('back-button').at(-1));
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });
});
