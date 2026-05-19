import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Register from './Register';
import { api } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));

describe('Register', () => {
  const user = { email: 'ana@example.com', name: 'Ana' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires a university before submitting', async () => {
    api.get.mockResolvedValue({ data: [] });
    render(<Register user={user} onComplete={jest.fn()} />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/universities'));
    fireEvent.submit(screen.getByTestId('register-form'));
    expect(toast.error).toHaveBeenCalledWith('Por favor selecciona una universidad');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('filters universities with text so the list is manageable', async () => {
    api.get.mockResolvedValue({
      data: [
        ...Array.from({ length: 9 }, (_, index) => ({ id: `uni-${index}`, name: `Universidad ${index}` })),
        { id: 'complutense', name: 'Universidad Complutense de Madrid' },
        { id: 'valencia', name: 'Universitat de València' },
      ],
    });

    render(<Register user={user} onComplete={jest.fn()} />);

    expect(await screen.findByText(/Mostrando 8 de 11 universidades/)).toBeInTheDocument();
    expect(screen.queryByText('Universidad Complutense de Madrid')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('university-search-input'), { target: { value: 'complu' } });
    expect(screen.getByText('Universidad Complutense de Madrid')).toBeInTheDocument();
    expect(screen.queryByText('Universidad 0')).not.toBeInTheDocument();

    fireEvent.change(screen.getByTestId('university-search-input'), { target: { value: 'valencia' } });
    expect(screen.getByText('Universitat de València')).toBeInTheDocument();
  });

  it('loads universities and completes registration', async () => {
    const onComplete = jest.fn();
    api.get.mockResolvedValue({ data: [{ id: 'uni', name: 'Universidad' }] });
    api.post.mockResolvedValue({ data: {} });
    render(<Register user={user} onComplete={onComplete} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Universidad' }));
    fireEvent.change(screen.getByTestId('name-input'), { target: { value: 'Ana Nueva' } });
    fireEvent.submit(screen.getByTestId('register-form'));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/register', {
      email: user.email,
      name: 'Ana Nueva',
      university_id: 'uni',
    }));
    expect(toast.success).toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalled();
  });

  it('reports loading and submission failures', async () => {
    api.get.mockRejectedValueOnce(new Error('fail'));
    render(<Register user={user} onComplete={jest.fn()} />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Error al cargar universidades'));
  });
});
