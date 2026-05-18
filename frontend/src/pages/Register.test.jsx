import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Register from './Register';
import { api } from '../services/api';
import { toast } from 'sonner';

jest.mock('../services/api', () => ({ api: { get: jest.fn(), post: jest.fn() } }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/ui/select', () => ({
  Select: ({ children, onValueChange, value }) => (
    <select aria-label="universidad" value={value} onChange={(event) => onValueChange(event.target.value)}>
      <option value="">Selecciona</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }) => <>{children}</>,
  SelectItem: ({ children, value }) => <option value={value}>{children}</option>,
}));

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

  it('loads universities and completes registration', async () => {
    const onComplete = jest.fn();
    api.get.mockResolvedValue({ data: [{ id: 'uni', name: 'Universidad' }] });
    api.post.mockResolvedValue({ data: {} });
    render(<Register user={user} onComplete={onComplete} />);
    fireEvent.change(await screen.findByLabelText('universidad'), { target: { value: 'uni' } });
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
