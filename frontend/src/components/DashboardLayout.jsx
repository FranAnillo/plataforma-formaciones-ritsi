import { LogOut, Menu, UserRound, X } from 'lucide-react';
import { useState } from 'react';
import logo from '../static/1710_Isotipo_Degradado.png';
import { boardPositionNames, roleNames } from '../utils/roles';

export default function DashboardLayout({ user, onLogout, tabs = [], activeTab, onTabChange, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = user.board_position ? boardPositionNames[user.board_position] : roleNames[user.user_type];
  const selectTab = id => { onTabChange?.(id); setMenuOpen(false); };
  return <div className="dashboard-shell">
    <header className="app-header"><div className="header-inner"><a href="/dashboard" className="brand-lockup"><img src={logo} alt="RITSI" /><span>Formación RITSI</span></a><div className="desktop-profile"><div className="user-chip"><UserRound size={17} /><span><strong>{user.name}</strong><small>{profile}</small></span></div><button className="logout-button" onClick={onLogout}><LogOut size={17} /><span>Salir</span></button></div><button className="mobile-menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir navegación">{menuOpen ? <X /> : <Menu />}</button></div></header>
    <div className="dashboard-body"><aside className={`sidebar ${menuOpen ? 'open' : ''}`}><div className="mobile-profile"><strong>{user.name}</strong><small>{profile}</small></div><nav>{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => selectTab(id)}><Icon size={19} />{label}</button>)}</nav><button className="mobile-logout" onClick={onLogout}><LogOut size={18} /> Cerrar sesión</button></aside><main className="dashboard-main">{children}</main></div>
  </div>;
}
