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
  const [compact, setCompact] = useState(
    () => window.localStorage.getItem('globetrotter.sidebar') === 'compact',
  );
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCompact = () => {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem('globetrotter.sidebar', next ? 'compact' : 'expanded');
      return next;
    });
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'nav-link nav-link--active' : 'nav-link';

  return (
    <div className={`app-shell ${compact ? 'app-shell--compact' : ''}`}>
      <aside
        className={`sidebar ${compact ? 'sidebar--compact' : ''} ${menuOpen ? 'sidebar--open' : ''}`}
      >
        <div className="brand">
          <span className="brand__mark">G</span>
          <span className="brand__name">GlobeTrotter</span>
        </div>
        <button
          type="button"
          className="sidebar__close"
          onClick={() => setMenuOpen(false)}
          aria-label="Close navigation"
        >
          <Icon name="close" />
        </button>
        <button
          type="button"
          className="sidebar__toggle"
          onClick={toggleCompact}
          aria-label={compact ? 'Expand navigation' : 'Compact navigation'}
          title={compact ? 'Expand navigation' : 'Compact navigation'}
        >
          <Icon name="arrow" />
        </button>
        <nav aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setMenuOpen(false)}
              className={navClass}
              title={compact ? item.label : undefined}
            >
              <Icon name={item.icon} />
              <span className="nav-link__label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__bottom">
          {user?.role === 'ADMIN' ? (
            <NavLink to="/admin" className={navClass} title={compact ? 'Admin' : undefined}>
              <Icon name="settings" />
              <span className="nav-link__label">Admin</span>
            </NavLink>
          ) : null}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              isActive ? 'profile-chip profile-chip--active' : 'profile-chip'
            }
            title={compact ? 'View profile' : undefined}
          >
            <span className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'T'}</span>
            <span className="profile-chip__copy">
              <strong>{user?.name ?? 'Traveler'}</strong>
              <small>View profile</small>
            </span>
            <Icon className="profile-chip__arrow" name="arrow" />
          </NavLink>
          <button
            type="button"
            className="nav-link nav-link--button"
            onClick={handleLogout}
            title={compact ? 'Sign out' : undefined}
          >
            <Icon name="logout" />
            <span className="nav-link__label">Sign out</span>
          </button>
        </div>
      </aside>
      {menuOpen ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}
      <main className="app-main">
        <div className="mobile-header">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>
          <div className="brand">
            <span className="brand__mark">G</span>
            <span>GlobeTrotter</span>
          </div>
          <span className="avatar">{user?.name?.slice(0, 1).toUpperCase() ?? 'T'}</span>
        </div>
        <div className="route-transition" key={location.pathname}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
