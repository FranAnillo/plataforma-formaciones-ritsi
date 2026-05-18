import { fireEvent, render, screen } from '@testing-library/react';
import DashboardLayout from './DashboardLayout';

jest.mock('./ThemeToggleButton', () => ({
  ThemeToggleButton: () => <button>tema</button>,
}));

describe('DashboardLayout', () => {
  it('renders role, headings, children and logout action', () => {
    const onLogout = jest.fn();
    render(
      <DashboardLayout
        user={{ name: 'Ana', user_type: 'admin' }}
        onLogout={onLogout}
        pageTitle="Panel"
        pageDescription="Resumen"
      >
        <span>contenido</span>
      </DashboardLayout>
    );
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText('Panel')).toBeInTheDocument();
    expect(screen.getByText('Resumen')).toBeInTheDocument();
    expect(screen.getByText('contenido')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cerrar sesión'));
    expect(onLogout).toHaveBeenCalled();
  });
});
