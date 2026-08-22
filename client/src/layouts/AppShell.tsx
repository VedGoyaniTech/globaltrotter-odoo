import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { useAuth } from '../hooks/useAuth';

const navItems = [
  { to: '/', label: 'Overview', icon: 'home' as const },
  { to: '/trips', label: 'My trips', icon: 'map' as const },
  { to: '/cities', label: 'Discover', icon: 'compass' as const },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' as const },
  { to: '/community', label: 'Community', icon: 'users' as const },
];

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
      <div className="brand"><span className="brand__mark">G</span><span>GlobeTrotter</span></div>
      <button type="button" className="sidebar__close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><Icon name="close" /></button>
      <nav aria-label="Primary navigation">
        {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Icon name={item.icon} /><span>{item.label}</span></NavLink>)}
      </nav>
      <div className="sidebar__bottom">
        {user?.role === 'ADMIN' ? <NavLink to="/admin" className={({ isActive }) => isActive ? 'nav-link nav-link--active' : 'nav-link'}><Icon name="settings" />Admin</NavLink> : null}
        <NavLink to="/profile" className={({ isActive }) => isActive ? 'profile-chip profile-chip--active' : 'profile-chip'}>
          <span className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'T'}</span><span><strong>{user?.name ?? 'Traveler'}</strong><small>View profile</small></span><Icon name="arrow" />
        </NavLink>
        <button type="button" className="nav-link nav-link--button" onClick={handleLogout}><Icon name="logout" />Sign out</button>
      </div>
    </aside>
    {menuOpen ? <button type="button" className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} /> : null}
    <main className="app-main">
      <div className="mobile-header"><button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><div className="brand"><span className="brand__mark">G</span><span>GlobeTrotter</span></div><span className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'T'}</span></div>
      <div className="route-transition" key={location.pathname}><Outlet /></div>
    </main>
  </div>;
}
