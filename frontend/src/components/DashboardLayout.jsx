import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { boardPositionNames, roleNames } from '../utils/roles';

const logo = '/1710_Isotipo_Degradado.png';

export default function DashboardLayout({ user, onLogout, tabs = [], activeTab, onTabChange, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia?.('(max-width: 820px)').matches || false);
  const menuButtonRef = useRef(null);
  const sidebarRef = useRef(null);
  const profile = user.board_position ? boardPositionNames[user.board_position] : roleNames[user.user_type];
  const selectTab = id => {
    onTabChange?.(id);
    setMenuOpen(false);
    requestAnimationFrame(() => document.getElementById('main-content')?.focus());
  };

  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const update = event => {
      setIsMobile(event.matches);
      if (!event.matches) setMenuOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    sidebarRef.current?.querySelector('nav button')?.focus();
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key === 'Tab') {
        const controls = [menuButtonRef.current, ...sidebarRef.current.querySelectorAll('button')].filter(Boolean);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return <div className="dashboard-shell">
    <a className="skip-link" href="#main-content">Saltar al contenido</a>
    <header className="app-header"><div className="header-inner"><a href="/dashboard" className="brand-lockup"><img src={logo} alt="Isotipo de RITSI" /><span>Formación RITSI</span></a><div className="desktop-profile"><div className="user-chip"><UserRound size={17} aria-hidden="true" /><span><strong>{user.name}</strong><small>{profile}</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} aria-hidden="true" /><span>Salir</span></button></div><button ref={menuButtonRef} className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Cerrar navegación' : 'Abrir navegación'} aria-expanded={menuOpen} aria-controls="dashboard-navigation">{menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button></div></header>
    <div className="dashboard-body"><button type="button" className={`sidebar-backdrop ${menuOpen ? 'visible' : ''}`} onClick={() => { setMenuOpen(false); menuButtonRef.current?.focus(); }} aria-label="Cerrar navegación" tabIndex={menuOpen ? 0 : -1} /><aside ref={sidebarRef} id="dashboard-navigation" className={`sidebar ${menuOpen ? 'open' : ''}`} aria-hidden={isMobile && !menuOpen ? 'true' : undefined} inert={isMobile && !menuOpen}><div className="mobile-profile"><strong>{user.name}</strong><small>{profile}</small></div><nav aria-label="Secciones de la plataforma">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={activeTab === id ? 'active' : ''} aria-current={activeTab === id ? 'page' : undefined} onClick={() => selectTab(id)}><Icon size={19} aria-hidden="true" />{label}</button>)}</nav><button className="mobile-logout" onClick={onLogout}><LogOut size={18} aria-hidden="true" /> Cerrar sesión</button></aside><main id="main-content" className="dashboard-main" tabIndex="-1" inert={isMobile && menuOpen}>{children}</main></div>
  </div>;
}
