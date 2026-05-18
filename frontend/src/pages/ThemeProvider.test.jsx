import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import { ThemeToggleButton } from '../components/ThemeToggleButton';

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme">{theme}</span>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('applies the system theme and persists explicit changes', () => {
    window.matchMedia.mockReturnValueOnce({ matches: true });
    render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeProbe />
        <ThemeToggleButton />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('test-theme')).toBe('system');

    fireEvent.click(screen.getByRole('button', { name: 'Activar tema oscuro' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(localStorage.getItem('test-theme')).toBe('dark');
  });

  it('loads a saved light theme and toggles to dark', () => {
    localStorage.setItem('test-theme', 'light');
    render(
      <ThemeProvider defaultTheme="system" storageKey="test-theme">
        <ThemeProbe />
        <ThemeToggleButton />
      </ThemeProvider>
    );
    expect(document.documentElement).toHaveClass('light');
    fireEvent.click(screen.getByRole('button', { name: 'Activar tema oscuro' }));
    expect(document.documentElement).toHaveClass('dark');
  });
});
