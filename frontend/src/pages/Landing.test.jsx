import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Landing from './Landing';
import { api } from '../services/api';

jest.mock('../services/api', () => ({
  BACKEND_URL: 'http://api.test',
  api: { get: jest.fn() },
}));
jest.mock('../components/ThemeToggleButton', () => ({
  ThemeToggleButton: () => <button>tema</button>,
}));

describe('Landing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.location;
    window.location = { href: 'http://localhost/' };
  });

  it('shows Google login and the local fallback when enabled', async () => {
    api.get.mockResolvedValue({ data: { dev_login_enabled: true } });
    render(<Landing />);
    await screen.findByText('Entrar en modo desarrollo');

    fireEvent.click(screen.getByTestId('login-button'));
    expect(window.location.href).toBe('http://api.test/api/auth/google/login');
    fireEvent.click(screen.getByTestId('dev-login-button'));
    expect(window.location.href).toBe('http://api.test/api/auth/dev-login');
  });

  it('hides the fallback when config cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    render(<Landing />);
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/config'));
    expect(screen.queryByText('Entrar en modo desarrollo')).not.toBeInTheDocument();
    expect(screen.getByText('Gestión de Formaciones RITSI')).toBeInTheDocument();
  });
});
